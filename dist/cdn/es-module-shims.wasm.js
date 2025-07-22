/* ES Module Shims Wasm 1.10.0 */
(function () {

  const hasDocument = typeof document !== 'undefined';

  const noop = () => {};

  const optionsScript = hasDocument ? document.querySelector('script[type=esms-options]') : undefined;

  const esmsInitOptions = optionsScript ? JSON.parse(optionsScript.innerHTML) : {};
  Object.assign(esmsInitOptions, self.esmsInitOptions || {});

  let shimMode = hasDocument ? !!esmsInitOptions.shimMode : true;

  const importHook = globalHook(shimMode && esmsInitOptions.onimport);
  const resolveHook = globalHook(shimMode && esmsInitOptions.resolve);
  let fetchHook = esmsInitOptions.fetch ? globalHook(esmsInitOptions.fetch) : fetch;
  const metaHook = esmsInitOptions.meta ? globalHook(shimMode && esmsInitOptions.meta) : noop;

  const mapOverrides = esmsInitOptions.mapOverrides;

  let nonce = esmsInitOptions.nonce;
  if (!nonce && hasDocument) {
    const nonceElement = document.querySelector('script[nonce]');
    if (nonceElement)
      nonce = nonceElement.nonce || nonceElement.getAttribute('nonce');
  }

  const onerror = globalHook(esmsInitOptions.onerror || noop);

  const { revokeBlobURLs, noLoadEventRetriggers, globalLoadEventRetrigger, enforceIntegrity } = esmsInitOptions;

  function globalHook (name) {
    return typeof name === 'string' ? self[name] : name;
  }

  const enable = Array.isArray(esmsInitOptions.polyfillEnable) ? esmsInitOptions.polyfillEnable : [];
  const cssModulesEnabled = enable.includes('css-modules');
  const jsonModulesEnabled = enable.includes('json-modules');
  const wasmModulesEnabled = enable.includes('wasm-modules');
  const sourcePhaseEnabled = enable.includes('source-phase');

  const onpolyfill = esmsInitOptions.onpolyfill ? globalHook(esmsInitOptions.onpolyfill) : () => {
    console.log(`%c^^ Module error above is polyfilled and can be ignored ^^`, 'font-weight:900;color:#391');
  };

  const edge = !navigator.userAgentData && !!navigator.userAgent.match(/Edge\/\d+\.\d+/);

  const baseUrl = hasDocument
    ? document.baseURI
    : `${location.protocol}//${location.host}${location.pathname.includes('/') 
    ? location.pathname.slice(0, location.pathname.lastIndexOf('/') + 1) 
    : location.pathname}`;

  const createBlob = (source, type = 'text/javascript') => URL.createObjectURL(new Blob([source], { type }));
  let { skip } = esmsInitOptions;
  if (Array.isArray(skip)) {
    const l = skip.map(s => new URL(s, baseUrl).href);
    skip = s => l.some(i => i[i.length - 1] === '/' && s.startsWith(i) || s === i);
  }
  else if (typeof skip === 'string') {
    const r = new RegExp(skip);
    skip = s => r.test(s);
  } else if (skip instanceof RegExp) {
    skip = s => skip.test(s);
  }

  const dispatchError = error => self.dispatchEvent(Object.assign(new Event('error'), { error }));

  const throwError = err => { (self.reportError || dispatchError)(err), void onerror(err); };

  function fromParent (parent) {
    return parent ? ` imported from ${parent}` : '';
  }

  let importMapSrcOrLazy = false;

  function setImportMapSrcOrLazy () {
    importMapSrcOrLazy = true;
  }

  // shim mode is determined on initialization, no late shim mode
  if (!shimMode) {
    if (document.querySelectorAll('script[type=module-shim],script[type=importmap-shim],link[rel=modulepreload-shim]').length) {
      shimMode = true;
    }
    else {
      let seenScript = false;
      for (const script of document.querySelectorAll('script[type=module],script[type=importmap]')) {
        if (!seenScript) {
          if (script.type === 'module' && !script.ep)
            seenScript = true;
        }
        else if (script.type === 'importmap' && seenScript) {
          importMapSrcOrLazy = true;
          break;
        }
      }
    }
  }

  const backslashRegEx = /\\/g;

  function asURL (url) {
    try {
      if (url.indexOf(':') !== -1)
        return new URL(url).href;
    }
    catch (_) {}
  }

  function resolveUrl (relUrl, parentUrl) {
    return resolveIfNotPlainOrUrl(relUrl, parentUrl) || (asURL(relUrl) || resolveIfNotPlainOrUrl('./' + relUrl, parentUrl));
  }

  function resolveIfNotPlainOrUrl (relUrl, parentUrl) {
    const hIdx = parentUrl.indexOf('#'), qIdx = parentUrl.indexOf('?');
    if (hIdx + qIdx > -2)
      parentUrl = parentUrl.slice(0, hIdx === -1 ? qIdx : qIdx === -1 || qIdx > hIdx ? hIdx : qIdx);
    if (relUrl.indexOf('\\') !== -1)
      relUrl = relUrl.replace(backslashRegEx, '/');
    // protocol-relative
    if (relUrl[0] === '/' && relUrl[1] === '/') {
      return parentUrl.slice(0, parentUrl.indexOf(':') + 1) + relUrl;
    }
    // relative-url
    else if (relUrl[0] === '.' && (relUrl[1] === '/' || relUrl[1] === '.' && (relUrl[2] === '/' || relUrl.length === 2 && (relUrl += '/')) ||
        relUrl.length === 1  && (relUrl += '/')) ||
        relUrl[0] === '/') {
      const parentProtocol = parentUrl.slice(0, parentUrl.indexOf(':') + 1);
      if (parentProtocol === 'blob:') {
        throw new TypeError(`Failed to resolve module specifier "${relUrl}". Invalid relative url or base scheme isn't hierarchical.`);
      }
      // Disabled, but these cases will give inconsistent results for deep backtracking
      //if (parentUrl[parentProtocol.length] !== '/')
      //  throw new Error('Cannot resolve');
      // read pathname from parent URL
      // pathname taken to be part after leading "/"
      let pathname;
      if (parentUrl[parentProtocol.length + 1] === '/') {
        // resolving to a :// so we need to read out the auth and host
        if (parentProtocol !== 'file:') {
          pathname = parentUrl.slice(parentProtocol.length + 2);
          pathname = pathname.slice(pathname.indexOf('/') + 1);
        }
        else {
          pathname = parentUrl.slice(8);
        }
      }
      else {
        // resolving to :/ so pathname is the /... part
        pathname = parentUrl.slice(parentProtocol.length + (parentUrl[parentProtocol.length] === '/'));
      }

      if (relUrl[0] === '/')
        return parentUrl.slice(0, parentUrl.length - pathname.length - 1) + relUrl;

      // join together and split for removal of .. and . segments
      // looping the string instead of anything fancy for perf reasons
      // '../../../../../z' resolved to 'x/y' is just 'z'
      const segmented = pathname.slice(0, pathname.lastIndexOf('/') + 1) + relUrl;

      const output = [];
      let segmentIndex = -1;
      for (let i = 0; i < segmented.length; i++) {
        // busy reading a segment - only terminate on '/'
        if (segmentIndex !== -1) {
          if (segmented[i] === '/') {
            output.push(segmented.slice(segmentIndex, i + 1));
            segmentIndex = -1;
          }
          continue;
        }
        // new segment - check if it is relative
        else if (segmented[i] === '.') {
          // ../ segment
          if (segmented[i + 1] === '.' && (segmented[i + 2] === '/' || i + 2 === segmented.length)) {
            output.pop();
            i += 2;
            continue;
          }
          // ./ segment
          else if (segmented[i + 1] === '/' || i + 1 === segmented.length) {
            i += 1;
            continue;
          }
        }
        // it is the start of a new segment
        while (segmented[i] === '/') i++;
        segmentIndex = i; 
      }
      // finish reading out the last segment
      if (segmentIndex !== -1)
        output.push(segmented.slice(segmentIndex));
      return parentUrl.slice(0, parentUrl.length - pathname.length) + output.join('');
    }
  }

  function resolveAndComposeImportMap (json, baseUrl, parentMap) {
    const outMap = { imports: Object.assign({}, parentMap.imports), scopes: Object.assign({}, parentMap.scopes), integrity: Object.assign({}, parentMap.integrity) };

    if (json.imports)
      resolveAndComposePackages(json.imports, outMap.imports, baseUrl, parentMap);

    if (json.scopes)
      for (let s in json.scopes) {
        const resolvedScope = resolveUrl(s, baseUrl);
        resolveAndComposePackages(json.scopes[s], outMap.scopes[resolvedScope] || (outMap.scopes[resolvedScope] = {}), baseUrl, parentMap);
      }

    if (json.integrity)
      resolveAndComposeIntegrity(json.integrity, outMap.integrity, baseUrl);

    return outMap;
  }

  function getMatch (path, matchObj) {
    if (matchObj[path])
      return path;
    let sepIndex = path.length;
    do {
      const segment = path.slice(0, sepIndex + 1);
      if (segment in matchObj)
        return segment;
    } while ((sepIndex = path.lastIndexOf('/', sepIndex - 1)) !== -1)
  }

  function applyPackages (id, packages) {
    const pkgName = getMatch(id, packages);
    if (pkgName) {
      const pkg = packages[pkgName];
      if (pkg === null) return;
      return pkg + id.slice(pkgName.length);
    }
  }


  function resolveImportMap (importMap, resolvedOrPlain, parentUrl) {
    let scopeUrl = parentUrl && getMatch(parentUrl, importMap.scopes);
    while (scopeUrl) {
      const packageResolution = applyPackages(resolvedOrPlain, importMap.scopes[scopeUrl]);
      if (packageResolution)
        return packageResolution;
      scopeUrl = getMatch(scopeUrl.slice(0, scopeUrl.lastIndexOf('/')), importMap.scopes);
    }
    return applyPackages(resolvedOrPlain, importMap.imports) || resolvedOrPlain.indexOf(':') !== -1 && resolvedOrPlain;
  }

  function resolveAndComposePackages (packages, outPackages, baseUrl, parentMap) {
    for (let p in packages) {
      const resolvedLhs = resolveIfNotPlainOrUrl(p, baseUrl) || p;
      if ((!shimMode || !mapOverrides) && outPackages[resolvedLhs] && (outPackages[resolvedLhs] !== packages[resolvedLhs])) {
        throw Error(`Rejected map override "${resolvedLhs}" from ${outPackages[resolvedLhs]} to ${packages[resolvedLhs]}.`);
      }
      let target = packages[p];
      if (typeof target !== 'string')
        continue;
      const mapped = resolveImportMap(parentMap, resolveIfNotPlainOrUrl(target, baseUrl) || target, baseUrl);
      if (mapped) {
        outPackages[resolvedLhs] = mapped;
        continue;
      }
      console.warn(`Mapping "${p}" -> "${packages[p]}" does not resolve`);
    }
  }

  function resolveAndComposeIntegrity (integrity, outIntegrity, baseUrl) {
    for (let p in integrity) {
      const resolvedLhs = resolveIfNotPlainOrUrl(p, baseUrl) || p;
      if ((!shimMode || !mapOverrides) && outIntegrity[resolvedLhs] && (outIntegrity[resolvedLhs] !== integrity[resolvedLhs])) {
        throw Error(`Rejected map integrity override "${resolvedLhs}" from ${outIntegrity[resolvedLhs]} to ${integrity[resolvedLhs]}.`);
      }
      outIntegrity[resolvedLhs] = integrity[p];
    }
  }

  let dynamicImport = !hasDocument && (0, eval)('u=>import(u)');

  let supportsDynamicImport;

  const dynamicImportCheck = hasDocument && new Promise(resolve => {
    const s = Object.assign(document.createElement('script'), {
      src: createBlob('self._d=u=>import(u)'),
      ep: true
    });
    s.setAttribute('nonce', nonce);
    s.addEventListener('load', () => {
      if (!(supportsDynamicImport = !!(dynamicImport = self._d))) {
        let err;
        window.addEventListener('error', _err => err = _err);
        dynamicImport = (url, opts) => new Promise((resolve, reject) => {
          const s = Object.assign(document.createElement('script'), {
            type: 'module',
            src: createBlob(`import*as m from'${url}';self._esmsi=m`)
          });
          err = undefined;
          s.ep = true;
          if (nonce)
            s.setAttribute('nonce', nonce);
          // Safari is unique in supporting module script error events
          s.addEventListener('error', cb);
          s.addEventListener('load', cb);
          function cb (_err) {
            document.head.removeChild(s);
            if (self._esmsi) {
              resolve(self._esmsi, baseUrl);
              self._esmsi = undefined;
            }
            else {
              reject(!(_err instanceof Event) && _err || err && err.error || new Error(`Error loading ${opts && opts.errUrl || url} (${s.src}).`));
              err = undefined;
            }
          }
          document.head.appendChild(s);
        });
      }
      document.head.removeChild(s);
      delete self._d;
      resolve();
    });
    document.head.appendChild(s);
  });

  // support browsers without dynamic import support (eg Firefox 6x)
  let supportsJsonAssertions = false;
  let supportsCssAssertions = false;

  const supports = hasDocument && HTMLScriptElement.supports;

  let supportsImportMaps = supports && supports.name === 'supports' && supports('importmap');
  let supportsImportMeta = supportsDynamicImport;
  let supportsWasmModules = false;
  let supportsSourcePhase = false;

  const wasmBytes = [0,97,115,109,1,0,0,0];

  let featureDetectionPromise = Promise.resolve(dynamicImportCheck).then(() => {
    if (!supportsDynamicImport)
      return;
    if (!hasDocument)
      return Promise.all([
        supportsImportMaps || dynamicImport(createBlob('import.meta')).then(() => supportsImportMeta = true, noop),
        cssModulesEnabled && dynamicImport(createBlob(`import"${createBlob('', 'text/css')}"with{type:"css"}`)).then(() => supportsCssAssertions = true, noop),
        jsonModulesEnabled && dynamicImport(createBlob(`import"${createBlob('{}', 'text/json')}"with{type:"json"}`)).then(() => supportsJsonAssertions = true, noop),
        wasmModulesEnabled && dynamicImport(createBlob(`import"${createBlob(new Uint8Array(wasmBytes), 'application/wasm')}"`)).then(() => supportsWasmModules = true, noop),
        wasmModulesEnabled && sourcePhaseEnabled && dynamicImport(createBlob(`import source x from"${createBlob(new Uint8Array(wasmBytes), 'application/wasm')}"`)).then(() => supportsSourcePhase = true, noop),
      ]);

    return new Promise(resolve => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.setAttribute('nonce', nonce);
      function cb ({ data }) {
        const isFeatureDetectionMessage = Array.isArray(data) && data[0] === 'esms';
        if (!isFeatureDetectionMessage)
          return;
        [, supportsImportMaps, supportsImportMeta, supportsCssAssertions, supportsJsonAssertions, supportsWasmModules, supportsSourcePhase] = data;
        resolve();
        document.head.removeChild(iframe);
        window.removeEventListener('message', cb, false);
      }
      window.addEventListener('message', cb, false);

      const importMapTest = `<script nonce=${nonce || ''}>b=(s,type='text/javascript')=>URL.createObjectURL(new Blob([s],{type}));document.head.appendChild(Object.assign(document.createElement('script'),{type:'importmap',nonce:"${nonce}",innerText:\`{"imports":{"x":"\${b('')}"}}\`}));Promise.all([${
      supportsImportMaps ? 'true,true' : `'x',b('import.meta')`}, ${
      cssModulesEnabled ? `b(\`import"\${b('','text/css')}"with{type:"css"}\`)` : 'false'}, ${
      jsonModulesEnabled ? `b(\`import"\${b('{}','text/json')\}"with{type:"json"}\`)` : 'false'}, ${
      wasmModulesEnabled ? `b(\`import"\${b(new Uint8Array(${JSON.stringify(wasmBytes)}),'application/wasm')\}"\`)` : 'false'}, ${
      wasmModulesEnabled && sourcePhaseEnabled ? `b(\`import source x from "\${b(new Uint8Array(${JSON.stringify(wasmBytes)}),'application/wasm')\}"\`)` : 'false'}].map(x =>typeof x==='string'?import(x).then(()=>true,()=>false):x)).then(a=>parent.postMessage(['esms'].concat(a),'*'))<${''}/script>`;

      // Safari will call onload eagerly on head injection, but we don't want the Wechat
      // path to trigger before setting srcdoc, therefore we track the timing
      let readyForOnload = false, onloadCalledWhileNotReady = false;
      function doOnload () {
        if (!readyForOnload) {
          onloadCalledWhileNotReady = true;
          return;
        }
        // WeChat browser doesn't support setting srcdoc scripts
        // But iframe sandboxes don't support contentDocument so we do this as a fallback
        const doc = iframe.contentDocument;
        if (doc && doc.head.childNodes.length === 0) {
          const s = doc.createElement('script');
          if (nonce)
            s.setAttribute('nonce', nonce);
          s.innerHTML = importMapTest.slice(15 + (nonce ? nonce.length : 0), -9);
          doc.head.appendChild(s);
        }
      }

      iframe.onload = doOnload;
      // WeChat browser requires append before setting srcdoc
      document.head.appendChild(iframe);

      // setting srcdoc is not supported in React native webviews on iOS
      // setting src to a blob URL results in a navigation event in webviews
      // document.write gives usability warnings
      readyForOnload = true;
      if ('srcdoc' in iframe)
        iframe.srcdoc = importMapTest;
      else
        iframe.contentDocument.write(importMapTest);
      // retrigger onload for Safari only if necessary
      if (onloadCalledWhileNotReady) doOnload();
    });
  });

  /* es-module-lexer 1.5.2 */
  var ImportType;!function(A){A[A.Static=1]="Static",A[A.Dynamic=2]="Dynamic",A[A.ImportMeta=3]="ImportMeta",A[A.StaticSourcePhase=4]="StaticSourcePhase",A[A.DynamicSourcePhase=5]="DynamicSourcePhase";}(ImportType||(ImportType={}));const A=1===new Uint8Array(new Uint16Array([1]).buffer)[0];function parse(E,g="@"){if(!C)return init.then((()=>parse(E)));const I=E.length+1,w=(C.__heap_base.value||C.__heap_base)+4*I-C.memory.buffer.byteLength;w>0&&C.memory.grow(Math.ceil(w/65536));const K=C.sa(I-1);if((A?B:Q)(E,new Uint16Array(C.memory.buffer,K,I)),!C.parse())throw Object.assign(new Error(`Parse error ${g}:${E.slice(0,C.e()).split("\n").length}:${C.e()-E.lastIndexOf("\n",C.e()-1)}`),{idx:C.e()});const o=[],D=[];for(;C.ri();){const A=C.is(),Q=C.ie(),B=C.it(),g=C.ai(),I=C.id(),w=C.ss(),K=C.se();let D;C.ip()&&(D=k(E.slice(-1===I?A-1:A,-1===I?Q+1:Q))),o.push({n:D,t:B,s:A,e:Q,ss:w,se:K,d:I,a:g});}for(;C.re();){const A=C.es(),Q=C.ee(),B=C.els(),g=C.ele(),I=E.slice(A,Q),w=I[0],K=B<0?void 0:E.slice(B,g),o=K?K[0]:"";D.push({s:A,e:Q,ls:B,le:g,n:'"'===w||"'"===w?k(I):I,ln:'"'===o||"'"===o?k(K):K});}function k(A){try{return (0,eval)(A)}catch(A){}}return [o,D,!!C.f(),!!C.ms()]}function Q(A,Q){const B=A.length;let C=0;for(;C<B;){const B=A.charCodeAt(C);Q[C++]=(255&B)<<8|B>>>8;}}function B(A,Q){const B=A.length;let C=0;for(;C<B;)Q[C]=A.charCodeAt(C++);}let C;const init=WebAssembly.compile((E="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","undefined"!=typeof Buffer?Buffer.from(E,"base64"):Uint8Array.from(atob(E),(A=>A.charCodeAt(0))))).then(WebAssembly.instantiate).then((({exports:A})=>{C=A;}));var E;

  async function _resolve (id, parentUrl) {
    const urlResolved = resolveIfNotPlainOrUrl(id, parentUrl) || asURL(id);
    return {
      r: resolveImportMap(importMap, urlResolved || id, parentUrl) || throwUnresolved(id, parentUrl),
      // b = bare specifier
      b: !urlResolved && !asURL(id)
    };
  }

  const resolve = resolveHook ? async (id, parentUrl) => {
    let result = resolveHook(id, parentUrl, defaultResolve);
    // will be deprecated in next major
    if (result && result.then)
      result = await result;
    return result ? { r: result, b: !resolveIfNotPlainOrUrl(id, parentUrl) && !asURL(id) } : _resolve(id, parentUrl);
  } : _resolve;

  // supports:
  // import('mod');
  // import('mod', { opts });
  // import('mod', { opts }, parentUrl);
  // import('mod', parentUrl);
  async function importHandler (id, ...args) {
    // parentUrl if present will be the last argument
    let parentUrl = args[args.length - 1];
    if (typeof parentUrl !== 'string')
      parentUrl = baseUrl;
    // needed for shim check
    await initPromise;
    if (importHook) await importHook(id, typeof args[1] !== 'string' ? args[1] : {}, parentUrl);
    if (acceptingImportMaps || shimMode || !baselinePassthrough) {
      if (hasDocument)
        processScriptsAndPreloads(true);
      if (!shimMode)
        acceptingImportMaps = false;
    }
    await importMapPromise;
    return (await resolve(id, parentUrl)).r;
  }

  // import()
  async function importShim (...args) {
    return topLevelLoad(await importHandler(...args), { credentials: 'same-origin' });
  }

  // import.source()
  if (sourcePhaseEnabled)
  importShim.source = async function importShimSource (...args) {
    const url = await importHandler(...args);
    const load = getOrCreateLoad(url, { credentials: 'same-origin' }, null, null);
    lastLoad = undefined;
    if (firstPolyfillLoad && !shimMode && load.n && nativelyLoaded) {
      onpolyfill();
      firstPolyfillLoad = false;
    }
    await load.f;
    return importShim._s[load.r];
  };

  self.importShim = importShim;

  function defaultResolve (id, parentUrl) {
    return resolveImportMap(importMap, resolveIfNotPlainOrUrl(id, parentUrl) || id, parentUrl) || throwUnresolved(id, parentUrl);
  }

  function throwUnresolved (id, parentUrl) {
    throw Error(`Unable to resolve specifier '${id}'${fromParent(parentUrl)}`);
  }

  const resolveSync = (id, parentUrl = baseUrl) => {
    parentUrl = `${parentUrl}`;
    const result = resolveHook && resolveHook(id, parentUrl, defaultResolve);
    return result && !result.then ? result : defaultResolve(id, parentUrl);
  };

  function metaResolve (id, parentUrl = this.url) {
    return resolveSync(id, parentUrl);
  }

  importShim.resolve = resolveSync;
  importShim.getImportMap = () => JSON.parse(JSON.stringify(importMap));
  importShim.addImportMap = importMapIn => {
    if (!shimMode) throw new Error('Unsupported in polyfill mode.');
    importMap = resolveAndComposeImportMap(importMapIn, baseUrl, importMap);
  };

  const registry = importShim._r = {};
  const sourceCache = importShim._s = {};

  async function loadAll (load, seen) {
    seen[load.u] = 1;
    await load.L;
    await Promise.all(load.d.map(({ l: dep, s: sourcePhase }) => {
      if (dep.b || seen[dep.u])
        return;
      if (sourcePhase)
        return dep.f;
      return loadAll(dep, seen);
    }));
    if (!load.n)
      load.n = load.d.some(dep => dep.l.n);
  }

  let importMap = { imports: {}, scopes: {}, integrity: {} };
  let baselinePassthrough;

  const initPromise = featureDetectionPromise.then(() => {
    baselinePassthrough = esmsInitOptions.polyfillEnable !== true && supportsDynamicImport && supportsImportMeta && supportsImportMaps && (!jsonModulesEnabled || supportsJsonAssertions) && (!cssModulesEnabled || supportsCssAssertions) && (!wasmModulesEnabled || supportsWasmModules) && (!sourcePhaseEnabled || supportsSourcePhase) && !importMapSrcOrLazy;
    if (sourcePhaseEnabled && typeof WebAssembly !== 'undefined' && !Object.getPrototypeOf(WebAssembly.Module).name) {
      const s = Symbol();
      const brand = m => Object.defineProperty(m, s, { writable: false, configurable: false, value: 'WebAssembly.Module' });
      class AbstractModuleSource {
        get [Symbol.toStringTag]() {
          if (this[s]) return this[s];
          throw new TypeError('Not an AbstractModuleSource');
        }
      }
      const { Module: wasmModule, compile: wasmCompile, compileStreaming: wasmCompileStreaming } = WebAssembly;
      WebAssembly.Module = Object.setPrototypeOf(Object.assign(function Module (...args) {
        return brand(new wasmModule(...args));
      }, wasmModule), AbstractModuleSource);
      WebAssembly.Module.prototype = Object.setPrototypeOf(wasmModule.prototype, AbstractModuleSource.prototype);
      WebAssembly.compile = function compile (...args) {
        return wasmCompile(...args).then(brand);
      };
      WebAssembly.compileStreaming = function compileStreaming(...args) {
        return wasmCompileStreaming(...args).then(brand);
      };
    }
    if (hasDocument) {
      if (!supportsImportMaps) {
        const supports = HTMLScriptElement.supports || (type => type === 'classic' || type === 'module');
        HTMLScriptElement.supports = type => type === 'importmap' || supports(type);
      }
      if (shimMode || !baselinePassthrough) {
        new MutationObserver(mutations => {
          for (const mutation of mutations) {
            if (mutation.type !== 'childList') continue;
            for (const node of mutation.addedNodes) {
              if (node.tagName === 'SCRIPT') {
                if (node.type === (shimMode ? 'module-shim' : 'module'))
                  processScript(node, true);
                if (node.type === (shimMode ? 'importmap-shim' : 'importmap'))
                  processImportMap(node, true);
              }
              else if (node.tagName === 'LINK' && node.rel === (shimMode ? 'modulepreload-shim' : 'modulepreload')) {
                processPreload(node);
              }
            }
          }
        }).observe(document, {childList: true, subtree: true});
        processScriptsAndPreloads();
        if (document.readyState === 'complete') {
          readyStateCompleteCheck();
        }
        else {
          async function readyListener() {
            await initPromise;
            processScriptsAndPreloads();
            if (document.readyState === 'complete') {
              readyStateCompleteCheck();
              document.removeEventListener('readystatechange', readyListener);
            }
          }
          document.addEventListener('readystatechange', readyListener);
        }
      }
    }
    return init;
  });
  let importMapPromise = initPromise;
  let firstPolyfillLoad = true;
  let acceptingImportMaps = true;

  async function topLevelLoad (url, fetchOpts, source, nativelyLoaded, lastStaticLoadPromise) {
    if (!shimMode)
      acceptingImportMaps = false;
    await initPromise;
    await importMapPromise;
    if (importHook) await importHook(url, typeof fetchOpts !== 'string' ? fetchOpts : {}, '');
    // early analysis opt-out - no need to even fetch if we have feature support
    if (!shimMode && baselinePassthrough) {
      // for polyfill case, only dynamic import needs a return value here, and dynamic import will never pass nativelyLoaded
      if (nativelyLoaded)
        return null;
      await lastStaticLoadPromise;
      return dynamicImport(source ? createBlob(source) : url, { errUrl: url || source });
    }
    const load = getOrCreateLoad(url, fetchOpts, null, source);
    linkLoad(load, fetchOpts);
    const seen = {};
    await loadAll(load, seen);
    lastLoad = undefined;
    resolveDeps(load, seen);
    await lastStaticLoadPromise;
    if (source && !shimMode && !load.n) {
      if (nativelyLoaded) return;
      if (revokeBlobURLs) revokeObjectURLs(Object.keys(seen));
      return await dynamicImport(createBlob(source), { errUrl: source });
    }
    if (firstPolyfillLoad && !shimMode && load.n && nativelyLoaded) {
      onpolyfill();
      firstPolyfillLoad = false;
    }
    const module = await dynamicImport(!shimMode && !load.n && nativelyLoaded ? load.u : load.b, { errUrl: load.u });
    // if the top-level load is a shell, run its update function
    if (load.s)
      (await dynamicImport(load.s)).u$_(module);
    if (revokeBlobURLs) revokeObjectURLs(Object.keys(seen));
    // when tla is supported, this should return the tla promise as an actual handle
    // so readystate can still correspond to the sync subgraph exec completions
    return module;
  }

  function revokeObjectURLs(registryKeys) {
    let batch = 0;
    const keysLength = registryKeys.length;
    const schedule = self.requestIdleCallback ? self.requestIdleCallback : self.requestAnimationFrame;
    schedule(cleanup);
    function cleanup() {
      const batchStartIndex = batch * 100;
      if (batchStartIndex > keysLength) return
      for (const key of registryKeys.slice(batchStartIndex, batchStartIndex + 100)) {
        const load = registry[key];
        if (load) URL.revokeObjectURL(load.b);
      }
      batch++;
      schedule(cleanup);
    }
  }

  function urlJsString (url) {
    return `'${url.replace(/'/g, "\\'")}'`;
  }

  let lastLoad;
  function resolveDeps (load, seen) {
    if (load.b || !seen[load.u])
      return;
    seen[load.u] = 0;

    for (const { l: dep, s: sourcePhase } of load.d) {
      if (!sourcePhase)
        resolveDeps(dep, seen);
    }

    const [imports, exports] = load.a;

    // "execution"
    const source = load.S;

    // edge doesnt execute sibling in order, so we fix this up by ensuring all previous executions are explicit dependencies
    let resolvedSource = edge && lastLoad ? `import '${lastLoad}';` : '';

    // once all deps have loaded we can inline the dependency resolution blobs
    // and define this blob
    let lastIndex = 0, depIndex = 0, dynamicImportEndStack = [];
    function pushStringTo (originalIndex) {
      while (dynamicImportEndStack[dynamicImportEndStack.length - 1] < originalIndex) {
        const dynamicImportEnd = dynamicImportEndStack.pop();
        resolvedSource += `${source.slice(lastIndex, dynamicImportEnd)}, ${urlJsString(load.r)}`;
        lastIndex = dynamicImportEnd;
      }
      resolvedSource += source.slice(lastIndex, originalIndex);
      lastIndex = originalIndex;
    }

    for (const { s: start, ss: statementStart, se: statementEnd, d: dynamicImportIndex, t } of imports) {
      // source phase
      if (t === 4) {
        let { l: depLoad } = load.d[depIndex++];
        pushStringTo(statementStart);
        resolvedSource += 'import ';
        lastIndex = statementStart + 14;
        pushStringTo(start - 1);
        resolvedSource += `/*${source.slice(start - 1, statementEnd)}*/'${createBlob(`export default importShim._s[${urlJsString(depLoad.r)}]`)}'`;
        lastIndex = statementEnd;
      }
      // dependency source replacements
      else if (dynamicImportIndex === -1) {
        let { l: depLoad } = load.d[depIndex++], blobUrl = depLoad.b, cycleShell = !blobUrl;
        if (cycleShell) {
          // circular shell creation
          if (!(blobUrl = depLoad.s)) {
            blobUrl = depLoad.s = createBlob(`export function u$_(m){${
            depLoad.a[1].map(({ s, e }, i) => {
              const q = depLoad.S[s] === '"' || depLoad.S[s] === "'";
              return `e$_${i}=m${q ? `[` : '.'}${depLoad.S.slice(s, e)}${q ? `]` : ''}`;
            }).join(',')
          }}${
            depLoad.a[1].length ? `let ${depLoad.a[1].map((_, i) => `e$_${i}`).join(',')};` : ''
          }export {${
            depLoad.a[1].map(({ s, e }, i) => `e$_${i} as ${depLoad.S.slice(s, e)}`).join(',')
          }}\n//# sourceURL=${depLoad.r}?cycle`);
          }
        }

        pushStringTo(start - 1);
        resolvedSource += `/*${source.slice(start - 1, statementEnd)}*/'${blobUrl}'`;

        // circular shell execution
        if (!cycleShell && depLoad.s) {
          resolvedSource += `;import*as m$_${depIndex} from'${depLoad.b}';import{u$_ as u$_${depIndex}}from'${depLoad.s}';u$_${depIndex}(m$_${depIndex})`;
          depLoad.s = undefined;
        }
        lastIndex = statementEnd;
      }
      // import.meta
      else if (dynamicImportIndex === -2) {
        load.m = { url: load.r, resolve: metaResolve };
        metaHook(load.m, load.u);
        pushStringTo(start);
        resolvedSource += `importShim._r[${urlJsString(load.u)}].m`;
        lastIndex = statementEnd;
      }
      // dynamic import
      else {
        pushStringTo(statementStart + 6);
        resolvedSource += `Shim${t === 5 ? '.source' : ''}(`;
        dynamicImportEndStack.push(statementEnd - 1);
        lastIndex = start;
      }
    }

    // support progressive cycle binding updates (try statement avoids tdz errors)
    if (load.s && (imports.length === 0 || imports[imports.length - 1].d === -1))
      resolvedSource += `\n;import{u$_}from'${load.s}';try{u$_({${exports.filter(e => e.ln).map(({ s, e, ln }) => `${source.slice(s, e)}:${ln}`).join(',')}})}catch(_){};\n`;

    function pushSourceURL (commentPrefix, commentStart) {
      const urlStart = commentStart + commentPrefix.length;
      const commentEnd = source.indexOf('\n', urlStart);
      const urlEnd = commentEnd !== -1 ? commentEnd : source.length;
      pushStringTo(urlStart);
      resolvedSource += new URL(source.slice(urlStart, urlEnd), load.r).href;
      lastIndex = urlEnd;
    }

    let sourceURLCommentStart = source.lastIndexOf(sourceURLCommentPrefix);
    let sourceMapURLCommentStart = source.lastIndexOf(sourceMapURLCommentPrefix);

    // ignore sourceMap comments before already spliced code
    if (sourceURLCommentStart < lastIndex) sourceURLCommentStart = -1;
    if (sourceMapURLCommentStart < lastIndex) sourceMapURLCommentStart = -1;

    // sourceURL first / only
    if (sourceURLCommentStart !== -1 && (sourceMapURLCommentStart === -1 || sourceMapURLCommentStart > sourceURLCommentStart)) {
      pushSourceURL(sourceURLCommentPrefix, sourceURLCommentStart);
    }
    // sourceMappingURL
    if (sourceMapURLCommentStart !== -1) {
      pushSourceURL(sourceMapURLCommentPrefix, sourceMapURLCommentStart);
      // sourceURL last
      if (sourceURLCommentStart !== -1 && (sourceURLCommentStart > sourceMapURLCommentStart))
        pushSourceURL(sourceURLCommentPrefix, sourceURLCommentStart);
    }

    pushStringTo(source.length);

    if (sourceURLCommentStart === -1)
      resolvedSource += sourceURLCommentPrefix + load.r;

    load.b = lastLoad = createBlob(resolvedSource);
    load.S = undefined;
  }

  const sourceURLCommentPrefix = '\n//# sourceURL=';
  const sourceMapURLCommentPrefix = '\n//# sourceMappingURL=';

  const jsContentType = /^(text|application)\/(x-)?javascript(;|$)/;
  const wasmContentType = /^(application)\/wasm(;|$)/;
  const jsonContentType = /^(text|application)\/json(;|$)/;
  const cssContentType = /^(text|application)\/css(;|$)/;

  const cssUrlRegEx = /url\(\s*(?:(["'])((?:\\.|[^\n\\"'])+)\1|((?:\\.|[^\s,"'()\\])+))\s*\)/g;

  // restrict in-flight fetches to a pool of 100
  let p = [];
  let c = 0;
  function pushFetchPool () {
    if (++c > 100)
      return new Promise(r => p.push(r));
  }
  function popFetchPool () {
    c--;
    if (p.length)
      p.shift()();
  }

  async function doFetch (url, fetchOpts, parent) {
    if (enforceIntegrity && !fetchOpts.integrity)
      throw Error(`No integrity for ${url}${fromParent(parent)}.`);
    const poolQueue = pushFetchPool();
    if (poolQueue) await poolQueue;
    try {
      var res = await fetchHook(url, fetchOpts);
    }
    catch (e) {
      e.message = `Unable to fetch ${url}${fromParent(parent)} - see network log for details.\n` + e.message;
      throw e;
    }
    finally {
      popFetchPool();
    }

    if (!res.ok) {
      const error = new TypeError(`${res.status} ${res.statusText} ${res.url}${fromParent(parent)}`);
      error.response = res;
      throw error;
    }
    return res;
  }

  async function fetchModule (url, fetchOpts, parent) {
    const mapIntegrity = importMap.integrity[url];
    const res = await doFetch(url, mapIntegrity && !fetchOpts.integrity ? Object.assign({}, fetchOpts, { integrity: mapIntegrity }) : fetchOpts, parent);
    const r = res.url;
    const contentType = res.headers.get('content-type');
    if (jsContentType.test(contentType))
      return { r, s: await res.text(), sp: null, t: 'js' };
    else if (wasmContentType.test(contentType)) {
      const module = await (sourceCache[r] || (sourceCache[r] = WebAssembly.compileStreaming(res)));
      sourceCache[r] = module;
      let s = '', i = 0, importObj = '';
      for (const impt of WebAssembly.Module.imports(module)) {
        const specifier = urlJsString(impt.module);
        s += `import * as impt${i} from ${specifier};\n`;
        importObj += `${specifier}:impt${i++},`;
      }
      i = 0;
      s += `const instance = await WebAssembly.instantiate(importShim._s[${urlJsString(r)}], {${importObj}});\n`;
      for (const expt of WebAssembly.Module.exports(module)) {
        s += `export const ${expt.name} = instance.exports['${expt.name}'];\n`;
      }
      return { r, s, t: 'wasm' };
    }
    else if (jsonContentType.test(contentType))
      return { r, s: `export default ${await res.text()}`, sp: null, t: 'json' };
    else if (cssContentType.test(contentType)) {
      return { r, s: `var s=new CSSStyleSheet();s.replaceSync(${
        JSON.stringify((await res.text()).replace(cssUrlRegEx, (_match, quotes = '', relUrl1, relUrl2) => `url(${quotes}${resolveUrl(relUrl1 || relUrl2, url)}${quotes})`))
      });export default s;`, ss: null, t: 'css' };
    }
    else
      throw Error(`Unsupported Content-Type "${contentType}" loading ${url}${fromParent(parent)}. Modules must be served with a valid MIME type like application/javascript.`);
  }

  function getOrCreateLoad (url, fetchOpts, parent, source) {
    if (source && registry[url]) {
      let i = 0;
      while (registry[url + ++i]);
      url += i;
    }
    let load = registry[url];
    if (load) return load;
    registry[url] = load = {
      // url
      u: url,
      // response url
      r: source ? url : undefined,
      // fetchPromise
      f: undefined,
      // source
      S: source,
      // linkPromise
      L: undefined,
      // analysis
      a: undefined,
      // deps
      d: undefined,
      // blobUrl
      b: undefined,
      // shellUrl
      s: undefined,
      // needsShim
      n: false,
      // type
      t: null,
      // meta
      m: null
    };
    load.f = (async () => {
      if (!load.S) {
        // preload fetch options override fetch options (race)
        let t;
        ({ r: load.r, s: load.S, t } = await (fetchCache[url] || fetchModule(url, fetchOpts, parent)));
        if (t && !shimMode) {
          if (t === 'css' && !cssModulesEnabled || t === 'json' && !jsonModulesEnabled || t === 'wasm' && !wasmModulesEnabled)
            throw featErr(`${t}-modules`);
          if (t === 'css' && !supportsCssAssertions || t === 'json' && !supportsJsonAssertions || t === 'wasm' && !supportsWasmModules)
            load.n = true;
        }
      }
      try {
        load.a = parse(load.S, load.u);
      }
      catch (e) {
        throwError(e);
        load.a = [[], [], false];
      }
      return load;
    })();
    return load;
  }

  const featErr = feat => Error(`${feat} feature must be enabled via <script type="esms-options">{ "polyfillEnable": ["${feat}"] }<${''}/script>`);

  function linkLoad (load, fetchOpts) {
    if (load.L) return;
    load.L = load.f.then(async () => {
      let childFetchOpts = fetchOpts;
      load.d = (await Promise.all(load.a[0].map(async ({ n, d, t }) => {
        const sourcePhase = t >= 4;
        if (sourcePhase && !sourcePhaseEnabled)
          throw featErr('source-phase');
        if (d >= 0 && !supportsDynamicImport || d === -2 && !supportsImportMeta || sourcePhase && !supportsSourcePhase)
          load.n = true;
        if (d !== -1 || !n) return;
        const { r, b } = await resolve(n, load.r || load.u);
        if (b && (!supportsImportMaps || importMapSrcOrLazy))
          load.n = true;
        if (d !== -1) return;
        if (skip && skip(r) && !sourcePhase) return { l: { b: r }, s: false };
        if (childFetchOpts.integrity)
          childFetchOpts = Object.assign({}, childFetchOpts, { integrity: undefined });
        const child = { l: getOrCreateLoad(r, childFetchOpts, load.r, null), s: sourcePhase };
        if (!child.s)
          linkLoad(child.l, fetchOpts);
        // load, sourcePhase
        return child;
      }))).filter(l => l);
    });
  }

  function processScriptsAndPreloads (mapsOnly = false) {
    if (!mapsOnly)
      for (const link of document.querySelectorAll(shimMode ? 'link[rel=modulepreload-shim]' : 'link[rel=modulepreload]'))
        processPreload(link);
    for (const script of document.querySelectorAll(shimMode ? 'script[type=importmap-shim]' : 'script[type=importmap]'))
      processImportMap(script);
    if (!mapsOnly)
      for (const script of document.querySelectorAll(shimMode ? 'script[type=module-shim]' : 'script[type=module]'))
        processScript(script);
  }

  function getFetchOpts (script) {
    const fetchOpts = {};
    if (script.integrity)
      fetchOpts.integrity = script.integrity;
    if (script.referrerPolicy)
      fetchOpts.referrerPolicy = script.referrerPolicy;
    if (script.fetchPriority)
      fetchOpts.priority = script.fetchPriority;
    if (script.crossOrigin === 'use-credentials')
      fetchOpts.credentials = 'include';
    else if (script.crossOrigin === 'anonymous')
      fetchOpts.credentials = 'omit';
    else
      fetchOpts.credentials = 'same-origin';
    return fetchOpts;
  }

  let lastStaticLoadPromise = Promise.resolve();

  let domContentLoadedCnt = 1;
  function domContentLoadedCheck () {
    if (--domContentLoadedCnt === 0 && !noLoadEventRetriggers && (shimMode || !baselinePassthrough)) {
      document.dispatchEvent(new Event('DOMContentLoaded'));
    }
  }
  let loadCnt = 1;
  function loadCheck () {
    if (--loadCnt === 0 && globalLoadEventRetrigger && !noLoadEventRetriggers && (shimMode || !baselinePassthrough)) {
      window.dispatchEvent(new Event('load'));
    }
  }
  // this should always trigger because we assume es-module-shims is itself a domcontentloaded requirement
  if (hasDocument) {
    document.addEventListener('DOMContentLoaded', async () => {
      await initPromise;
      domContentLoadedCheck();
    });
    window.addEventListener('load', async () => {
      await initPromise;
      loadCheck();
    });
  }

  let readyStateCompleteCnt = 1;
  function readyStateCompleteCheck () {
    if (--readyStateCompleteCnt === 0 && !noLoadEventRetriggers && (shimMode || !baselinePassthrough)) {
      document.dispatchEvent(new Event('readystatechange'));
    }
  }

  const hasNext = script => script.nextSibling || script.parentNode && hasNext(script.parentNode);
  const epCheck = (script, ready) => script.ep || !ready && (!script.src && !script.innerHTML || !hasNext(script)) || script.getAttribute('noshim') !== null || !(script.ep = true);

  function processImportMap (script, ready = readyStateCompleteCnt > 0) {
    if (epCheck(script, ready)) return;
    // we dont currently support multiple, external or dynamic imports maps in polyfill mode to match native
    if (script.src) {
      if (!shimMode)
        return;
      setImportMapSrcOrLazy();
    }
    if (acceptingImportMaps) {
      importMapPromise = importMapPromise
        .then(async () => {
          importMap = resolveAndComposeImportMap(script.src ? await (await doFetch(script.src, getFetchOpts(script))).json() : JSON.parse(script.innerHTML), script.src || baseUrl, importMap);
        })
        .catch(e => {
          console.log(e);
          if (e instanceof SyntaxError)
            e = new Error(`Unable to parse import map ${e.message} in: ${script.src || script.innerHTML}`);
          throwError(e);
        });
      if (!shimMode)
        acceptingImportMaps = false;
    }
  }

  function processScript (script, ready = readyStateCompleteCnt > 0) {
    if (epCheck(script, ready)) return;
    // does this load block readystate complete
    const isBlockingReadyScript = script.getAttribute('async') === null && readyStateCompleteCnt > 0;
    // does this load block DOMContentLoaded
    const isDomContentLoadedScript = domContentLoadedCnt > 0;
    const isLoadScript = loadCnt > 0;
    if (isLoadScript) loadCnt++;
    if (isBlockingReadyScript) readyStateCompleteCnt++;
    if (isDomContentLoadedScript) domContentLoadedCnt++;
    const loadPromise = topLevelLoad(script.src || baseUrl, getFetchOpts(script), !script.src && script.innerHTML, !shimMode, isBlockingReadyScript && lastStaticLoadPromise)
      .catch(throwError);
    if (!noLoadEventRetriggers)
      loadPromise.then(() => script.dispatchEvent(new Event('load')));
    if (isBlockingReadyScript)
      lastStaticLoadPromise = loadPromise.then(readyStateCompleteCheck);
    if (isDomContentLoadedScript)
      loadPromise.then(domContentLoadedCheck);
    if (isLoadScript)
      loadPromise.then(loadCheck);
  }

  const fetchCache = {};
  function processPreload (link) {
    if (link.ep) return;
    link.ep = true;
    if (fetchCache[link.href])
      return;
    fetchCache[link.href] = fetchModule(link.href, getFetchOpts(link));
  }

})();
