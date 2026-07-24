use std::path::Path;

fn run() -> Result<(), String> {
    let mut arguments = std::env::args_os();
    let _executable = arguments.next();
    let source = arguments
        .next()
        .ok_or_else(|| "Usage: pake-payload-pack <executable> <archive> <metadata>".to_string())?;
    let archive = arguments
        .next()
        .ok_or_else(|| "Usage: pake-payload-pack <executable> <archive> <metadata>".to_string())?;
    let metadata = arguments
        .next()
        .ok_or_else(|| "Usage: pake-payload-pack <executable> <archive> <metadata>".to_string())?;
    if arguments.next().is_some() {
        return Err("Usage: pake-payload-pack <executable> <archive> <metadata>".into());
    }
    pake_online_installer::payload::pack_windows_payload(
        Path::new(&source),
        Path::new(&archive),
        Path::new(&metadata),
    )
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
