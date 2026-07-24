#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::io;
use std::iter;
use std::os::windows::ffi::OsStrExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use windows_sys::Win32::System::ApplicationInstallationAndServicing::{
    MsiCloseHandle, MsiGetProductPropertyW, MsiOpenPackageW, MsiQueryProductStateW,
    INSTALLSTATE_DEFAULT, MSIHANDLE,
};

#[cfg(not(test))]
static MSI_BYTES: &[u8] = include_bytes!(env!("PAKE_OFFLINE_MSI"));
#[cfg(test)]
static MSI_BYTES: &[u8] = b"test-msi";

struct MsiHandle(MSIHANDLE);

impl Drop for MsiHandle {
    fn drop(&mut self) {
        unsafe {
            MsiCloseHandle(self.0);
        }
    }
}

fn wide_null(value: &std::ffi::OsStr) -> Vec<u16> {
    value.encode_wide().chain(iter::once(0)).collect()
}

fn msi_product_code(msi_path: &Path) -> Result<Vec<u16>, String> {
    let package_path = wide_null(msi_path.as_os_str());
    let mut raw_handle = 0;
    let open_result = unsafe { MsiOpenPackageW(package_path.as_ptr(), &mut raw_handle) };
    if open_result != 0 {
        return Err(format!(
            "Failed to inspect the MSI package (Windows Installer error {open_result})."
        ));
    }
    let handle = MsiHandle(raw_handle);
    let property: Vec<u16> = "ProductCode".encode_utf16().chain(iter::once(0)).collect();
    let mut product_code = vec![0_u16; 39];
    let mut length = product_code.len() as u32;
    let property_result = unsafe {
        MsiGetProductPropertyW(
            handle.0,
            property.as_ptr(),
            product_code.as_mut_ptr(),
            &mut length,
        )
    };
    if property_result != 0 {
        return Err(format!(
            "Failed to read the MSI ProductCode (Windows Installer error {property_result})."
        ));
    }
    product_code.truncate(length as usize);
    if product_code.is_empty() {
        return Err("The MSI package does not contain a ProductCode.".into());
    }
    product_code.push(0);
    Ok(product_code)
}

fn product_is_installed(msi_path: &Path) -> Result<bool, String> {
    let product_code = msi_product_code(msi_path)?;
    Ok(unsafe { MsiQueryProductStateW(product_code.as_ptr()) } == INSTALLSTATE_DEFAULT)
}

fn msiexec_arguments(msi_path: &Path, reinstall: bool) -> Vec<String> {
    let mut arguments = vec![
        "/i".into(),
        msi_path.display().to_string(),
        "/norestart".into(),
    ];
    if reinstall {
        arguments.extend(["REINSTALL=ALL".into(), "REINSTALLMODE=amus".into()]);
    }
    arguments
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
        let reinstall = product_is_installed(&msi_path)?;
        let status = Command::new("msiexec.exe")
            .args(msiexec_arguments(&msi_path, reinstall))
            .status()
            .map_err(|error| format!("Failed to launch Windows Installer: {error}"))?;
        Ok(status.code().unwrap_or(1))
    })();
    if let Err(error) = fs::remove_file(&msi_path) {
        eprintln!("Failed to remove the temporary MSI: {error}");
    }
    if let Err(error) = fs::remove_dir(&temporary) {
        eprintln!("Failed to remove the temporary installer directory: {error}");
    }
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
    fn first_install_omits_reinstall_arguments() {
        let arguments = msiexec_arguments(Path::new(r"C:\Temp\application.msi"), false);
        assert_eq!(arguments[0], "/i");
        assert!(!arguments.iter().any(|value| value == "REINSTALL=ALL"));
        assert!(!arguments.iter().any(|value| value == "REINSTALLMODE=amus"));
    }

    #[test]
    fn existing_install_passes_reinstall_arguments() {
        let arguments = msiexec_arguments(Path::new(r"C:\Temp\application.msi"), true);
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
