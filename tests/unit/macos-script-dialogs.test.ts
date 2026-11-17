import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rustRoot = path.join(process.cwd(), 'src-tauri', 'src');
const read = (relative: string) =>
  // A Windows checkout has CRLF line endings; the patterns below are written for LF.
  fs.readFileSync(path.join(rustRoot, relative), 'utf8').replace(/\r\n/g, '\n');

describe('macOS alert(), confirm() and prompt()', () => {
  it('is installed on every webview the one window builder makes', () => {
    const modules = read('app/mod.rs');
    expect(modules).toMatch(
      /#\[cfg\(target_os = "macos"\)\]\npub mod script_dialogs;/,
    );

    const window = read('app/window.rs');
    const start = window.indexOf('fn build_window(');
    const end = window.indexOf('\n}\n', start);
    expect(window.slice(start, end)).toMatch(
      /#\[cfg\(target_os = "macos"\)\]\s+if let Err\(error\) = window\.with_webview\(\|webview\| \{\s+crate::app::script_dialogs::install\(&webview\);/,
    );
  });

  it('answers the three WKUIDelegate panels WebKit would otherwise skip', () => {
    const dialogs = read('app/script_dialogs.rs');
    for (const selector of [
      'webView:runJavaScriptAlertPanelWithMessage:initiatedByFrame:completionHandler:',
      'webView:runJavaScriptConfirmPanelWithMessage:initiatedByFrame:completionHandler:',
      'webView:runJavaScriptTextInputPanelWithPrompt:defaultText:initiatedByFrame:completionHandler:',
    ]) {
      expect(dialogs).toContain(`c"${selector}"`);
    }
    expect(dialogs).toContain('let selector = Sel::register(selector);');
    // Added only where the delegate's class has no answer of its own.
    expect(dialogs).toContain('if class.instance_method(selector).is_some() {');
  });

  it('sets the delegate again, since WebKit caches what it answers', () => {
    const dialogs = read('app/script_dialogs.rs');
    const added = dialogs.indexOf('class_addMethod(');
    const reset = dialogs.indexOf('msg_send![view, setUIDelegate: none]');
    const restored = dialogs.indexOf(
      'msg_send![view, setUIDelegate: &*delegate]',
    );
    expect(added).toBeGreaterThan(-1);
    // Without this the methods exist and are never called: the page still
    // gets false from confirm() in a millisecond.
    expect(reset).toBeGreaterThan(added);
    expect(restored).toBeGreaterThan(reset);
  });

  it('hands WebKit its answer exactly once, when the sheet is dismissed', () => {
    const dialogs = read('app/script_dialogs.rs');
    expect(dialogs).toContain('beginSheetModalForWindow: window');
    expect(dialogs).toContain('let finish = Cell::new(Some(finish));');
    expect(dialogs).toContain('let Some(finish) = finish.take() else {');
    // Cancel is false for confirm() and null for prompt(), as in a browser.
    expect(dialogs).toContain(
      'let accepted = response == NSAlertFirstButtonReturn;',
    );
    expect(dialogs).toContain('None => done.call((std::ptr::null_mut(),)),');
  });

  it('keeps the panel on the page window and Escape on Cancel', () => {
    const dialogs = read('app/script_dialogs.rs');
    // A hidden or minimised window still gets a sheet, which AppKit shows
    // with the window; only a webview with no window gets an app-modal panel.
    const fallback = dialogs.indexOf('if window.is_null() {');
    const modal = dialogs.indexOf('alert.runModal()');
    expect(fallback).toBeGreaterThan(-1);
    expect(modal).toBeGreaterThan(fallback);
    expect(dialogs).not.toMatch(/isVisible/);
    // AppKit binds Escape only to a button titled "Cancel"; 取消 is not.
    expect(dialogs).toContain(
      'cancel.setKeyEquivalent(&NSString::from_str("\\u{1b}"));',
    );
  });
});
