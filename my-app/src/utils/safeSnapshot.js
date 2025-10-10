import { onSnapshot } from 'firebase/firestore';

// Global registry to track active user-scoped subscriptions
const _userSubs = new Set();

function _track(unsub){
  if(typeof unsub !== 'function') return () => {};
  _userSubs.add(unsub);
  return () => {
    try { _userSubs.delete(unsub); } catch {}
    try { unsub(); } catch {}
  };
}

export function clearUserSubscriptions(){
  try {
    for(const fn of Array.from(_userSubs)){
      try { fn(); } catch {}
      try { _userSubs.delete(fn); } catch {}
    }
  } catch {}
}

// Wrap Firestore onSnapshot with consistent error handling and auto-tracking
export function safeSnapshot(refOrQuery, onNext, onError){
  const unsub = onSnapshot(refOrQuery, (snap)=>{
    try { onNext && onNext(snap); } catch {}
  }, (err)=>{
    // Swallow common auth/rules transitions; forward others
    const code = String(err?.code||'');
    if(code === 'permission-denied' || code === 'unauthenticated'){
      // Stop this listener to avoid repeated console errors after sign-out or rule failures
      try { unsub(); } catch {}
      try { onError && onError(err); } catch {}
      return;
    }
    try { console.warn('onSnapshot error', err); } catch {}
    try { onError && onError(err); } catch {}
  });
  return _track(unsub);
}

// Allow manual subscriptions (non-Firestore) to join the same lifecycle
export function trackSubscription(unsubscribe){
  return _track(unsubscribe);
}
