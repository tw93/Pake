import {
	AnimationMixer,
	Box3,
	Mesh,
	MeshLambertMaterial,
	Object3D,
	TextureLoader,
	UVMapping,
	SRGBColorSpace
} from 'three';
import { MD2Loader } from '../loaders/MD2Loader.js';

class MD2Character {

	constructor() {

		this.scale = 1;
		this.animationFPS = 6;

		this.root = new Object3D();

		this.meshBody = null;
		this.meshWeapon = null;

		this.skinsBody = [];
		this.skinsWeapon = [];

		this.weapons = [];

		this.activeAnimation = null;

		this.mixer = null;

		this.onLoadComplete = function () {};

		this.loadCounter = 0;

	}

	loadParts( config ) {

		const scope = this;

		function createPart( geometry, skinMap ) {

			const materialWireframe = new MeshLambertMaterial( { color: 0xffaa00, wireframe: true } );
			const materialTexture = new MeshLambertMaterial( { color: 0xffffff, wireframe: false, map: skinMap } );

			//

			const mesh = new Mesh( geometry, materialTexture );
			mesh.rotation.y = - Math.PI / 2;

			mesh.castShadow = true;
			mesh.receiveShadow = true;

			//

			mesh.materialTexture = materialTexture;
			mesh.materialWireframe = materialWireframe;

			return mesh;

		}

		function loadTextures( baseUrl, textureUrls ) {

			const textureLoader = new TextureLoader();
			const textures = [];

			for ( let i = 0; i < textureUrls.length; i ++ ) {

				textures[ i ] = textureLoader.load( baseUrl + textureUrls[ i ], checkLoadingComplete );
				textures[ i ].mapping = UVMapping;
				textures[ i ].name = textureUrls[ i ];
				textures[ i ].colorSpace = SRGBColorSpace;

			}

			return textures;

		}

		function checkLoadingComplete() {

			scope.loadCounter -= 1;

			if ( scope.loadCounter === 0 ) scope.onLoadComplete();

		}

		this.loadCounter = config.weapons.length * 2 + config.skins.length + 1;

		const weaponsTextures = [];
		for ( let i = 0; i < config.weapons.length; i ++ ) weaponsTextures[ i ] = config.weapons[ i ][ 1 ];
		// SKINS

		this.skinsBody = loadTextures( config.baseUrl + 'skins/', config.skins );
		this.skinsWeapon = loadTextures( config.baseUrl + 'skins/', weaponsTextures );

		// BODY

		const loader = new MD2Loader();

		loader.load( config.baseUrl + config.body, function ( geo ) {

			const boundingBox = new Box3();
			boundingBox.setFromBufferAttribute( geo.attributes.position );

			scope.root.position.y = - scope.scale * boundingBox.min.y;

			const mesh = createPart( geo, scope.skinsBody[ 0 ] );
			mesh.scale.set( scope.scale, scope.scale, scope.scale );

			scope.root.add( mesh );

			scope.meshBody = mesh;

			scope.meshBody.clipOffset = 0;
			scope.activeAnimationClipName = mesh.geometry.animations[ 0 ].name;

			scope.mixer = new AnimationMixer( mesh );

			checkLoadingComplete();

		} );

		// WEAPONS

		const generateCallback = function ( index, name ) {

			return function ( geo ) {

				const mesh = createPart( geo, scope.skinsWeapon[ index ] );
				mesh.scale.set( scope.scale, scope.scale, scope.scale );
				mesh.visible = false;

				mesh.name = name;

				scope.root.add( mesh );

				scope.weapons[ index ] = mesh;
				scope.meshWeapon = mesh;

				checkLoadingComplete();

			};

		};

		for ( let i = 0; i < config.weapons.length; i ++ ) {

			loader.load( config.baseUrl + config.weapons[ i ][ 0 ], generateCallback( i, config.weapons[ i ][ 0 ] ) );

		}

	}

	setPlaybackRate( rate ) {

		if ( rate !== 0 ) {

			this.mixer.timeScale = 1 / rate;

		} else {

			this.mixer.timeScale = 0;

		}

	}

	setWireframe( wireframeEnabled ) {

		if ( wireframeEnabled ) {

			if ( this.meshBody ) this.meshBody.material = this.meshBody.materialWireframe;
			if ( this.meshWeapon ) this.meshWeapon.material = this.meshWeapon.materialWireframe;

		} else {

			if ( this.meshBody ) this.meshBody.material = this.meshBody.materialTexture;
			if ( this.meshWeapon ) this.meshWeapon.material = this.meshWeapon.materialTexture;

		}

	}

	setSkin( index ) {

		if ( this.meshBody && this.meshBody.material.wireframe === false ) {

			this.meshBody.material.map = this.skinsBody[ index ];

		}

	}

	setWeapon( index ) {

		for ( let i = 0; i < this.weapons.length; i ++ ) this.weapons[ i ].visible = false;

		const activeWeapon = this.weapons[ index ];

		if ( activeWeapon ) {

			activeWeapon.visible = true;
			this.meshWeapon = activeWeapon;

			this.syncWeaponAnimation();

		}

	}

	setAnimation( clipName ) {

		if ( this.meshBody ) {

			if ( this.meshBody.activeAction ) {

				this.meshBody.activeAction.stop();
				this.meshBody.activeAction = null;

			}

			const action = this.mixer.clipAction( clipName, this.meshBody );

			if ( action ) {

				this.meshBody.activeAction = action.play();

			}

		}

		this.activeClipName = clipName;

		this.syncWeaponAnimation();

	}

	syncWeaponAnimation() {

		const clipName = this.activeClipName;

		if ( this.meshWeapon ) {

			if ( this.meshWeapon.activeAction ) {

				this.meshWeapon.activeAction.stop();
				this.meshWeapon.activeAction = null;

			}

			const action = this.mixer.clipAction( clipName, this.meshWeapon );

			if ( action ) {

				this.meshWeapon.activeAction = action.syncWith( this.meshBody.activeAction ).play();

			}

		}

	}

	update( delta ) {

		if ( this.mixer ) this.mixer.update( delta );

	}

}

export { MD2Character };
