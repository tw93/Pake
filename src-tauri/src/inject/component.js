document.addEventListener('DOMContentLoaded', () => {
  // Toast
  function pakeToast(msg) {
    const m = document.createElement('div');
    m.innerHTML = msg;
    m.style.cssText =
      'max-width:60%;min-width: 80px;padding:0 12px;height: 32px;color: rgb(255, 255, 255);line-height: 32px;text-align: center;border-radius: 8px;position: fixed; bottom:24px;right: 28px;z-index: 999999;background: rgba(0, 0, 0,.8);font-size: 13px;';
    document.body.appendChild(m);
    setTimeout(function () {
      const d = 0.5;
      m.style.transition = 'transform ' + d + 's ease-in, opacity ' + d + 's ease-in';
      m.style.opacity = '0';
      setTimeout(function () {
        document.body.removeChild(m);
      }, d * 1000);
    }, 3000);
  }

  window.pakeToast = pakeToast;
});
