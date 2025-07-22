import { UIPanel, UIRow, UIHorizontalRule } from './libs/ui.js';

window.addEventListener('message', function(event) {
  const { type, data } = event.data;
  if(type === 'hideLoading') {
    hideLoading()
  }
  if(type === 'loadOptions' && data) {
    editor.fromJSON(data).then(res => {
      const boundingBox = new THREE.Box3().setFromObject(editor.scene);
      const objectCenter = new THREE.Vector3();
      boundingBox.getCenter(objectCenter);
    
      editorControls.center.set(objectCenter.x, objectCenter.y, objectCenter.z);
      editor.camera.lookAt(objectCenter);
    })

    hideLoading()
  } 
});
function MenubarFile( editor ) {

	const strings = editor.strings;

	const saveArrayBuffer = editor.utils.saveArrayBuffer;
	const saveString = editor.utils.saveString;

	const container = new UIPanel();
	container.setClass( 'menu' );

	const title = new UIPanel();
	title.setClass( 'title' );
	title.setTextContent( strings.getKey( 'menubar/file' ) );
	container.add( title );

	const options = new UIPanel();
	options.setClass( 'options' );
	container.add( options );

	// New

	let option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/file/new' ) );
	option.onClick( function () {

		if ( confirm( 'Any unsaved data will be lost. Are you sure?' ) ) {

			editor.clear();

		}

	} );
	options.add( option );

	//

	options.add( new UIHorizontalRule() );

	// Import

	const form = document.createElement( 'form' );
	form.style.display = 'none';
	document.body.appendChild( form );

	const fileInput = document.createElement( 'input' );
	fileInput.multiple = true;
	fileInput.type = 'file';
	fileInput.addEventListener( 'change', function () {

		editor.loader.loadFiles( fileInput.files );
		form.reset();

	} );
	form.appendChild( fileInput );

	option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/file/import' ) );
	option.onClick( function () {

		fileInput.click();

	} );
	options.add( option );
	
  let params = new URLSearchParams(window.location.search)

  let id = params.get('id')
  if (id) {
    showLoading()
    parent.postMessage(
      {
        type: 'findById',
        data: {
          id: id,
        }
    }, '*');
  }

	//

	options.add( new UIHorizontalRule() );

	// Export DRC

	option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/file/export/drc' ) );
	option.onClick( async function () {

		const object = editor.selected;

		if ( object === null || object.isMesh === undefined ) {

			alert( 'No mesh selected' );
			return;

		}

		const { DRACOExporter } = await import( 'three/addons/exporters/DRACOExporter.js' );

		const exporter = new DRACOExporter();

		const options = {
			decodeSpeed: 5,
			encodeSpeed: 5,
			encoderMethod: DRACOExporter.MESH_EDGEBREAKER_ENCODING,
			quantization: [ 16, 8, 8, 8, 8 ],
			exportUvs: true,
			exportNormals: true,
			exportColor: object.geometry.hasAttribute( 'color' )
		};

		// TODO: Change to DRACOExporter's parse( geometry, onParse )?
		const result = exporter.parse( object, options );
		saveArrayBuffer( result, 'model.drc' );

	} );
	options.add( option );

	// Export GLB

	option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/file/export/glb' ) );
	option.onClick( async function () {

		const scene = editor.scene;
		const animations = getAnimations( scene );

		const optimizedAnimations = [];

		for ( const animation of animations ) {

			optimizedAnimations.push( animation.clone().optimize() );

		}

		const { GLTFExporter } = await import( 'three/addons/exporters/GLTFExporter.js' );

		const exporter = new GLTFExporter();

		exporter.parse( scene, function ( result ) {

			saveArrayBuffer( result, 'scene.glb' );

		}, undefined, { binary: true, animations: optimizedAnimations } );

	} );
	options.add( option );

	// Export GLTF

	option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/file/export/gltf' ) );
	option.onClick( async function () {

		const scene = editor.scene;
		const animations = getAnimations( scene );

		const optimizedAnimations = [];

		for ( const animation of animations ) {

			optimizedAnimations.push( animation.clone().optimize() );

		}

		const { GLTFExporter } = await import( 'three/addons/exporters/GLTFExporter.js' );

		const exporter = new GLTFExporter();

		exporter.parse( scene, function ( result ) {

			saveString( JSON.stringify( result, null, 2 ), 'scene.gltf' );

		}, undefined, { animations: optimizedAnimations } );


	} );
	options.add( option );

	// Export OBJ

	option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/file/export/obj' ) );
	option.onClick( async function () {

		const object = editor.selected;

		if ( object === null ) {

			alert( 'No object selected.' );
			return;

		}

		const { OBJExporter } = await import( 'three/addons/exporters/OBJExporter.js' );

		const exporter = new OBJExporter();

		saveString( exporter.parse( object ), 'model.obj' );

	} );
	options.add( option );

	// Export PLY (ASCII)

	option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/file/export/ply' ) );
	option.onClick( async function () {

		const { PLYExporter } = await import( 'three/addons/exporters/PLYExporter.js' );

		const exporter = new PLYExporter();

		exporter.parse( editor.scene, function ( result ) {

			saveArrayBuffer( result, 'model.ply' );

		} );

	} );
	options.add( option );

	// Export PLY (Binary)

	option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/file/export/ply_binary' ) );
	option.onClick( async function () {

		const { PLYExporter } = await import( 'three/addons/exporters/PLYExporter.js' );

		const exporter = new PLYExporter();

		exporter.parse( editor.scene, function ( result ) {

			saveArrayBuffer( result, 'model-binary.ply' );

		}, { binary: true } );

	} );
	options.add( option );

	// Export STL (ASCII)

	option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/file/export/stl' ) );
	option.onClick( async function () {

		const { STLExporter } = await import( 'three/addons/exporters/STLExporter.js' );

		const exporter = new STLExporter();

		saveString( exporter.parse( editor.scene ), 'model.stl' );

	} );
	options.add( option );

	// Export STL (Binary)

	option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/file/export/stl_binary' ) );
	option.onClick( async function () {

		const { STLExporter } = await import( 'three/addons/exporters/STLExporter.js' );

		const exporter = new STLExporter();

		saveArrayBuffer( exporter.parse( editor.scene, { binary: true } ), 'model-binary.stl' );

	} );
	options.add( option );

	// Export USDZ

	option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/file/export/usdz' ) );
	option.onClick( async function () {

		const { USDZExporter } = await import( 'three/addons/exporters/USDZExporter.js' );

		const exporter = new USDZExporter();

		saveArrayBuffer( await exporter.parse( editor.scene ), 'model.usdz' );

	} );
	options.add( option );

	
  // Publish
	
	options.add( new UIHorizontalRule() );
	
  const link = document.createElement('a')
  function save(blob, filename, upload) {
    if (link.href) {
      URL.revokeObjectURL(link.href)
    }

    filename = filename || 'data.json'

    link.href = URL.createObjectURL(blob)
    link.download = filename
    if (!upload) {
      link.dispatchEvent(new MouseEvent('click'))
    } else {
      const parts = filename.split('.')
      const extension = parts[parts.length - 1]

      let params = new URLSearchParams(window.location.search)
      let id = params.get('id')

      const fullFilename = `${id}.${extension}`

      showLoading()
      
      parent.postMessage(
        {
          type: 'saveFile',
          data: {
            id: id,
            blob: blob,
            fileName: fullFilename,
          }
      }, '*');
    }
  }

  option = new UIRow()
  option.setClass('option')

  option.setTextContent('【保存项目】')
  option.onClick(function () {
    let output = editor.toJSON()
    output.metadata.type = 'App'
    delete output.history

    output = JSON.stringify(output, null, '\t')
    output = output.replace(/[\n\t]+([\d\.e\-\[\]]+)/g, '$1')

    const blob = new Blob([output], { type: 'application/json' })
    save(blob, '', true)
  })
  options.add(option)

	//

	function getAnimations( scene ) {

		const animations = [];

		scene.traverse( function ( object ) {

			animations.push( ... object.animations );

		} );

		return animations;

	}

	return container;

}

function showLoading() {
  // 创建加载盒子元素
  const loadingBox = document.createElement('div');
  loadingBox.id = 'loading-box';
  loadingBox.style.position = 'fixed';
  loadingBox.style.top = '0';
  loadingBox.style.left = '0';
  loadingBox.style.width = '100%';
  loadingBox.style.height = '100%';
  loadingBox.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  loadingBox.style.display = 'flex';
  loadingBox.style.justifyContent = 'center';
  loadingBox.style.alignItems = 'center';
  loadingBox.style.zIndex = '999';
  
  // 创建加载图标元素
  const loadingIcon = document.createElement('div');
  loadingIcon.style.width = '50px';
  loadingIcon.style.height = '50px';
  loadingIcon.style.borderRadius = '50%';
  loadingIcon.style.border = '2px solid #fff';
  loadingIcon.style.borderTopColor = 'transparent';
  loadingIcon.style.animation = 'spin 1s linear infinite';
  
  // 将加载图标添加到加载盒子中
  loadingBox.appendChild(loadingIcon);
  
  // 将加载盒子添加到<body>标签中
  document.body.appendChild(loadingBox);
}

function hideLoading() {
  // 获取加载盒子元素
  const loadingBox = document.getElementById('loading-box');
  // 如果存在加载盒子，则从<body>标签中移除
  if (loadingBox) {
    document.body.removeChild(loadingBox);
  }
}

export { MenubarFile };
