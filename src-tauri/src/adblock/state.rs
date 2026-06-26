use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

#[derive(Clone)]
pub struct AdblockSession {
    enabled: Arc<AtomicBool>,
    recovery_triggered: Arc<AtomicBool>,
}

impl AdblockSession {
    pub fn new(enabled: bool) -> Self {
        Self {
            enabled: Arc::new(AtomicBool::new(enabled)),
            recovery_triggered: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled.load(Ordering::SeqCst)
    }

    pub fn set_enabled(&self, enabled: bool) {
        self.enabled.store(enabled, Ordering::SeqCst);
        if enabled {
            self.recovery_triggered.store(false, Ordering::SeqCst);
        }
    }

    pub fn disable_for_recovery(&self) -> bool {
        if self.recovery_triggered.swap(true, Ordering::SeqCst) {
            return false;
        }
        self.enabled.store(false, Ordering::SeqCst);
        true
    }
}

#[cfg(test)]
mod tests {
    use super::AdblockSession;

    #[test]
    fn recovery_can_only_trigger_once() {
        let state = AdblockSession::new(true);
        assert!(state.disable_for_recovery());
        assert!(!state.disable_for_recovery());
        assert!(!state.is_enabled());
    }

    #[test]
    fn enabling_resets_recovery_for_future_failures() {
        let state = AdblockSession::new(true);
        assert!(state.disable_for_recovery());
        assert!(!state.is_enabled());

        state.set_enabled(true);

        assert!(state.is_enabled());
        assert!(state.disable_for_recovery());
    }
}
