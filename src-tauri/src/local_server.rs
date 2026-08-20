use crate::app::config::ServerConfig;
use std::net::{TcpStream, ToSocketAddrs};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

#[cfg(unix)]
use std::os::unix::process::CommandExt;

#[cfg(windows)]
use std::os::windows::{io::AsRawHandle, process::CommandExt};

#[cfg(windows)]
use windows_sys::Win32::{
    Foundation::{CloseHandle, HANDLE, INVALID_HANDLE_VALUE},
    System::{
        Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Thread32First, Thread32Next, TH32CS_SNAPTHREAD, THREADENTRY32,
        },
        JobObjects::{
            AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
            SetInformationJobObject, TerminateJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
            JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        },
        Threading::{OpenThread, ResumeThread, CREATE_SUSPENDED, THREAD_SUSPEND_RESUME},
    },
};

const PROBE_INTERVAL: Duration = Duration::from_millis(150);
const CONNECT_TIMEOUT: Duration = Duration::from_millis(500);
const SHUTDOWN_GRACE: Duration = Duration::from_secs(3);

pub type OwnedServer = Arc<Mutex<Option<ManagedServer>>>;

#[derive(Debug)]
pub struct ManagedServer {
    child: Child,
    #[cfg(windows)]
    job: WindowsJob,
}

impl Drop for ManagedServer {
    fn drop(&mut self) {
        self.shutdown();
    }
}

impl ManagedServer {
    fn shutdown(&mut self) {
        if matches!(self.child.try_wait(), Ok(Some(_))) {
            return;
        }

        #[cfg(unix)]
        unsafe {
            libc::kill(-(self.child.id() as i32), libc::SIGTERM);
        }

        #[cfg(windows)]
        {
            let _ = Command::new("taskkill")
                .args(["/PID", &self.child.id().to_string(), "/T"])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
        }

        let deadline = Instant::now() + SHUTDOWN_GRACE;
        while Instant::now() < deadline {
            if matches!(self.child.try_wait(), Ok(Some(_))) {
                return;
            }
            std::thread::sleep(Duration::from_millis(50));
        }

        #[cfg(unix)]
        unsafe {
            libc::kill(-(self.child.id() as i32), libc::SIGKILL);
        }

        #[cfg(windows)]
        unsafe {
            TerminateJobObject(self.job.handle(), 1);
        }

        let _ = self.child.wait();
    }
}

#[cfg(windows)]
#[derive(Debug)]
struct WindowsJob(isize);

#[cfg(windows)]
struct WindowsSnapshot(HANDLE);

#[cfg(windows)]
impl WindowsJob {
    fn handle(&self) -> HANDLE {
        self.0 as HANDLE
    }
}

#[cfg(windows)]
impl Drop for WindowsJob {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.handle());
        }
    }
}

#[cfg(windows)]
impl Drop for WindowsSnapshot {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.0);
        }
    }
}

fn socket_addresses(config: &ServerConfig) -> Result<Vec<std::net::SocketAddr>, String> {
    (config.host.as_str(), config.port)
        .to_socket_addrs()
        .map(|addresses| addresses.collect())
        .map_err(|error| {
            format!(
                "Could not resolve local server address {}:{}: {error}",
                config.host, config.port
            )
        })
}

fn port_is_listening(config: &ServerConfig) -> Result<bool, String> {
    let addresses = socket_addresses(config)?;
    Ok(addresses
        .iter()
        .any(|address| TcpStream::connect_timeout(address, CONNECT_TIMEOUT).is_ok()))
}

fn shell_command(command: &str) -> Command {
    #[cfg(unix)]
    {
        let fallback = if cfg!(target_os = "macos") {
            "/bin/zsh"
        } else {
            "/bin/sh"
        };
        let shell = std::env::var("SHELL")
            .ok()
            .filter(|path| path.starts_with('/') && std::path::Path::new(path).is_file())
            .unwrap_or_else(|| fallback.to_string());
        let mut process = Command::new(shell);
        process.args(["-lic", command]);
        process.process_group(0);
        process
    }

    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let mut process = Command::new("cmd.exe");
        process.args(["/D", "/S", "/C", command]);
        process.creation_flags(CREATE_NO_WINDOW | CREATE_SUSPENDED);
        process
    }
}

#[cfg(windows)]
fn resume_process_threads(child: &Child) -> Result<(), String> {
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0);
        if snapshot == INVALID_HANDLE_VALUE {
            return Err(format!(
                "Could not inspect the suspended local server process: {}",
                std::io::Error::last_os_error()
            ));
        }
        let _snapshot = WindowsSnapshot(snapshot);

        let mut entry = THREADENTRY32 {
            dwSize: std::mem::size_of::<THREADENTRY32>() as u32,
            ..Default::default()
        };
        let mut has_entry = Thread32First(snapshot, &mut entry);
        if has_entry == 0 {
            return Err(format!(
                "Could not enumerate the suspended local server threads: {}",
                std::io::Error::last_os_error()
            ));
        }

        let mut resumed = false;
        while has_entry != 0 {
            if entry.th32OwnerProcessID == child.id() {
                let thread = OpenThread(THREAD_SUSPEND_RESUME, 0, entry.th32ThreadID);
                if thread.is_null() {
                    return Err(format!(
                        "Could not open a suspended local server thread: {}",
                        std::io::Error::last_os_error()
                    ));
                }
                let result = ResumeThread(thread);
                let resume_error = (result == u32::MAX).then(std::io::Error::last_os_error);
                CloseHandle(thread);
                if let Some(error) = resume_error {
                    return Err(format!(
                        "Could not resume the local server process: {error}"
                    ));
                }
                resumed = true;
            }
            has_entry = Thread32Next(snapshot, &mut entry);
        }

        if resumed {
            Ok(())
        } else {
            Err("Could not find the suspended local server thread.".to_string())
        }
    }
}

#[cfg(windows)]
fn create_kill_on_close_job(child: &Child) -> Result<WindowsJob, String> {
    unsafe {
        let handle = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if handle.is_null() {
            return Err(format!(
                "Could not create a Windows job object: {}",
                std::io::Error::last_os_error()
            ));
        }

        let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if SetInformationJobObject(
            handle,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const _,
            std::mem::size_of_val(&info) as u32,
        ) == 0
        {
            let error = std::io::Error::last_os_error();
            CloseHandle(handle);
            return Err(format!(
                "Could not configure the Windows job object: {error}"
            ));
        }

        if AssignProcessToJobObject(handle, child.as_raw_handle() as HANDLE) == 0 {
            let error = std::io::Error::last_os_error();
            CloseHandle(handle);
            return Err(format!(
                "Could not attach the local server to its Windows job object: {error}"
            ));
        }

        let job = WindowsJob(handle as isize);
        resume_process_threads(child)?;
        Ok(job)
    }
}

fn spawn_server(command: &str) -> Result<ManagedServer, String> {
    let mut process = shell_command(command);
    process
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    let child = process
        .spawn()
        .map_err(|error| format!("Could not start the local server command: {error}"))?;

    #[cfg(windows)]
    let job = match create_kill_on_close_job(&child) {
        Ok(job) => job,
        Err(error) => {
            let mut child = child;
            let _ = child.kill();
            return Err(error);
        }
    };

    Ok(ManagedServer {
        child,
        #[cfg(windows)]
        job,
    })
}

pub fn start_or_reuse(config: Option<&ServerConfig>) -> Result<Option<ManagedServer>, String> {
    let Some(config) = config else {
        return Ok(None);
    };
    if port_is_listening(config)? {
        return Ok(None);
    }

    let mut server = spawn_server(&config.command)?;
    let deadline = Instant::now() + Duration::from_secs(config.timeout);
    while Instant::now() < deadline {
        match server.child.try_wait() {
            Ok(Some(status)) => {
                return Err(format!(
                    "The local server command exited before port {} was ready ({status}). Run the command in a terminal to inspect the error.",
                    config.port
                ));
            }
            Ok(None) => {}
            Err(error) => {
                return Err(format!(
                    "Could not inspect the local server process: {error}"
                ));
            }
        }

        if port_is_listening(config)? {
            return Ok(Some(server));
        }
        std::thread::sleep(PROBE_INTERVAL);
    }

    Err(format!(
        "The local server did not listen on {}:{} within {} seconds.",
        config.host, config.port, config.timeout
    ))
}

pub fn terminate_owned(server: &OwnedServer) {
    if let Ok(mut server) = server.lock() {
        server.take();
    }
}

pub fn show_startup_error(app: &AppHandle, message: String) {
    eprintln!("[Pake] Local server startup failed: {message}");
    let app_handle = app.clone();
    app.dialog()
        .message(message)
        .title("Pake could not start the local server")
        .kind(MessageDialogKind::Error)
        .show(move |_| app_handle.exit(1));
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;

    fn free_port() -> u16 {
        TcpListener::bind(("127.0.0.1", 0))
            .unwrap()
            .local_addr()
            .unwrap()
            .port()
    }

    fn config(port: u16, command: String, timeout: u64) -> ServerConfig {
        ServerConfig {
            host: "127.0.0.1".to_string(),
            port,
            command,
            timeout,
        }
    }

    #[test]
    fn reuses_an_existing_listener_without_ownership() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let result = start_or_reuse(Some(&config(port, "unused".to_string(), 1))).unwrap();
        assert!(result.is_none());
        assert!(listener.local_addr().is_ok());
    }

    #[test]
    fn reports_a_command_that_exits_before_listening() {
        let port = free_port();
        #[cfg(unix)]
        let command = "exit 7".to_string();
        #[cfg(windows)]
        let command = "exit /b 7".to_string();
        let error = start_or_reuse(Some(&config(port, command, 2))).unwrap_err();
        assert!(error.contains("exited before port"));
    }

    #[test]
    fn reports_a_startup_timeout() {
        let port = free_port();
        #[cfg(unix)]
        let command = "sleep 5".to_string();
        #[cfg(windows)]
        let command = "ping -n 6 127.0.0.1 >NUL".to_string();
        let error = start_or_reuse(Some(&config(port, command, 1))).unwrap_err();
        assert!(error.contains("within 1 seconds"));
    }

    #[test]
    fn starts_and_terminates_an_owned_server() {
        let port = free_port();
        let executable = std::env::current_exe().unwrap();
        #[cfg(unix)]
        let command = format!(
            "PAKE_TEST_SERVER_PORT={port} '{}' --exact local_server::tests::managed_server_helper --nocapture",
            executable.to_string_lossy().replace('\'', "'\\''")
        );
        #[cfg(windows)]
        let command = format!(
            "set PAKE_TEST_SERVER_PORT={port}&& \"{}\" --exact local_server::tests::managed_server_helper --nocapture",
            executable.to_string_lossy().replace('"', "\\\"")
        );

        let server = start_or_reuse(Some(&config(port, command, 5)))
            .unwrap()
            .expect("test helper should be owned");
        assert!(port_is_listening(&config(port, String::new(), 1)).unwrap());
        drop(server);

        let deadline = Instant::now() + Duration::from_secs(5);
        while Instant::now() < deadline {
            if !port_is_listening(&config(port, String::new(), 1)).unwrap() {
                return;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        panic!("owned server port remained open after shutdown");
    }

    #[test]
    fn managed_server_helper() {
        let Ok(port) = std::env::var("PAKE_TEST_SERVER_PORT") else {
            return;
        };
        let _listener = TcpListener::bind(("127.0.0.1", port.parse::<u16>().unwrap())).unwrap();
        loop {
            std::thread::sleep(Duration::from_secs(60));
        }
    }
}
