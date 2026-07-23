use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(not(test))]
static MSI_BYTES: &[u8] = include_bytes!(env!("PAKE_OFFLINE_MSI"));
#[cfg(test)]
static MSI_BYTES: &[u8] = b"test-msi";

fn msiexec_arguments(msi_path: &Path) -> Vec<String> {
    vec![
        "/i".into(),
        msi_path.display().to_string(),
        "/norestart".into(),
        "REINSTALL=ALL".into(),
        "REINSTALLMODE=amus".into(),
    ]
}

fn create_temporary_directory() -> io::Result<PathBuf> {
    let base = std::env::temp_dir();
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    for attempt in 0..100_u32 {
        let directory = base.join(format!(
            "pake-offline-installer-{}-{timestamp}-{attempt}",
            std::process::id()
        ));
        match fs::create_dir(&directory) {
            Ok(()) => return Ok(directory),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error),
        }
    }
    Err(io::Error::new(
        io::ErrorKind::AlreadyExists,
        "could not allocate a temporary installer directory",
    ))
}

fn run() -> Result<i32, String> {
    let temporary = create_temporary_directory()
        .map_err(|error| format!("Failed to create a temporary directory: {error}"))?;
    let msi_path = temporary.join("application.msi");
    let result = (|| {
        fs::write(&msi_path, MSI_BYTES)
            .map_err(|error| format!("Failed to extract the embedded MSI: {error}"))?;
        let status = Command::new("msiexec.exe")
            .args(msiexec_arguments(&msi_path))
            .status()
            .map_err(|error| format!("Failed to launch Windows Installer: {error}"))?;
        Ok(status.code().unwrap_or(1))
    })();
    let _ = fs::remove_file(&msi_path);
    let _ = fs::remove_dir(&temporary);
    result
}

fn main() {
    match run() {
        Ok(code) => std::process::exit(code),
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn passes_reinstall_arguments_to_msiexec() {
        let arguments = msiexec_arguments(Path::new(r"C:\Temp\application.msi"));
        assert_eq!(arguments[0], "/i");
        assert!(arguments.iter().any(|value| value == "REINSTALL=ALL"));
        assert!(arguments.iter().any(|value| value == "REINSTALLMODE=amus"));
    }

    #[test]
    fn temporary_directory_can_be_cleaned() {
        let directory = create_temporary_directory().unwrap();
        fs::write(directory.join("test"), b"test").unwrap();
        fs::remove_dir_all(&directory).unwrap();
        assert!(!directory.exists());
    }
}
