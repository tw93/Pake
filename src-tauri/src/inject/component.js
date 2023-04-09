document.addEventListener('DOMContentLoaded', () => {
  // Create a modal
  const modalHtml = `
  <div id="pakeUrlModal" class="pake-modal">
    <div class="pake-modal-container">
      <div class="pake-modal-content">
        <label for="pakeUrlInput">Enter URL to navigate anywhere</label>
        <input type="text" id="pakeUrlInput" />
        <button id="pakeUrlSubmit">Submit</button>
        <button id="pakeUrlClose">Close</button>
      </div>
    </div>
  </div>
  `;

  const modalStyle = `
  .pake-modal {
    display: none;
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.4);
  }

  .pake-modal-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .pake-modal-content {
    background-color: #fff;
    padding: 20px;
    border-radius: 10px;
    width: 80%;
    max-width: 400px;
    font-size:14px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .pake-modal-content label {
    display: block;
    margin-bottom: 12px;
    font-weight: bold;
  }

  .pake-modal-content input[type="text"] {
    width: 90%;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    margin-bottom: 12px;
    outline: none;
  }

  .pake-modal-content button {
    background: #11182B;
    color: #FFF;
    padding: 6px 14px;
    border-radius: 4px;
    cursor: pointer;
    margin-right: 4px;
    font-size:14px;
    border: 1px solid #11182B;
  }

  #pakeUrlClose{
    background: #fff;
    color: #11182B;
  }
  `;

  const modalDiv = document.createElement('div');
  modalDiv.innerHTML = modalHtml;
  document.body.appendChild(modalDiv);

  const modalStyleElement = document.createElement('style');
  modalStyleElement.innerText = modalStyle;
  document.head.appendChild(modalStyleElement);

  const urlModal = document.getElementById('pakeUrlModal');
  const urlInput = document.getElementById('pakeUrlInput');
  const urlSubmit = document.getElementById('pakeUrlSubmit');
  const urlClose = document.getElementById('pakeUrlClose');

  urlSubmit.onclick = function () {
    const url = urlInput.value;
    if (url) {
      window.location.href = url;
    }
  };

  urlClose.onclick = function () {
    urlModal.style.display = 'none';
  };

  urlInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      const url = urlInput.value;
      if (url) {
        window.location.href = url;
      }
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && urlModal.style.display === 'block') {
      urlModal.style.display = 'none';
    }
  });

  window.showUrlModal = function () {
    urlModal.style.display = 'block';
    urlInput.focus();
  };

  // Toast
  function pakeToast(msg) {
    const m = document.createElement('div');
    m.innerHTML = msg;
    m.style.cssText =
      'max-width:60%;min-width: 80px;padding:0 12px;height: 32px;color: rgb(255, 255, 255);line-height: 32px;text-align: center;border-radius: 8px;position: fixed; bottom:24px;right: 28px;z-index: 999999;background: rgba(0, 0, 0,.8);font-size: 13px;';
    document.body.appendChild(m);
    setTimeout(function () {
      const d = 0.5;
      m.style.transition =
        'transform ' + d + 's ease-in, opacity ' + d + 's ease-in';
      m.style.opacity = '0';
      setTimeout(function () {
        document.body.removeChild(m);
      }, d * 1000);
    }, 3000);
  }

  window.pakeToast = pakeToast;
});
