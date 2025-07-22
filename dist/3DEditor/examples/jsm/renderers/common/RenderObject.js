import ClippingContext from "./ClippingContext.js";

let id = 0;

export default class RenderObject {

	constructor( nodes, geometries, renderer, object, material, scene, camera, lightsNode, renderContext ) {

		this._nodes = nodes;
		this._geometries = geometries;

		this.id = id ++;

		this.renderer = renderer;
		this.object = object;
		this.material = material;
		this.scene = scene;
		this.camera = camera;
		this.lightsNode = lightsNode;
		this.context = renderContext;

		this.geometry = object.geometry;
		this.version = material.version;

		this.attributes = null;
		this.pipeline = null;
		this.vertexBuffers = null;

		this.updateClipping( renderContext.clippingContext );

		this.clippingContextVersion = this.clippingContext.version;

		this.initialNodesCacheKey = this.getNodesCacheKey();
		this.initialCacheKey = this.getCacheKey();

		this._nodeBuilderState = null;
		this._bindings = null;

		this.onDispose = null;

		this.isRenderObject = true;

		this.onMaterialDispose = () => {

			this.dispose();

		};

		this.material.addEventListener( 'dispose', this.onMaterialDispose );

	}

	updateClipping( parent ) {

		const material = this.material;

		let clippingContext = this.clippingContext;

		if ( Array.isArray( material.clippingPlanes ) ) {

			if ( clippingContext === parent || ! clippingContext ) {

				clippingContext = new ClippingContext();
				this.clippingContext = clippingContext;

			}

			clippingContext.update( parent, material );

		} else if ( this.clippingContext !== parent ) {

			this.clippingContext = parent;

		}

	}

	clippingNeedsUpdate () {

		if ( this.clippingContext.version === this.clippingContextVersion ) return false;

		this.clippingContextVersion = this.clippingContext.version;

		return true;

	}

	getNodeBuilderState() {

		return this._nodeBuilderState || ( this._nodeBuilderState = this._nodes.getForRender( this ) );

	}

	getBindings() {

		return this._bindings || ( this._bindings = this.getNodeBuilderState().createBindings() );

	}

	getIndex() {

		return this._geometries.getIndex( this );

	}

	getChainArray() {

		return [ this.object, this.material, this.context, this.lightsNode ];

	}

	getAttributes() {

		if ( this.attributes !== null ) return this.attributes;

		const nodeAttributes = this.getNodeBuilderState().nodeAttributes;
		const geometry = this.geometry;

		const attributes = [];
		const vertexBuffers = new Set();

		for ( const nodeAttribute of nodeAttributes ) {

			const attribute = nodeAttribute.node && nodeAttribute.node.attribute ? nodeAttribute.node.attribute : geometry.getAttribute( nodeAttribute.name );

			if ( attribute === undefined ) continue;

			attributes.push( attribute );

			const bufferAttribute = attribute.isInterleavedBufferAttribute ? attribute.data : attribute;
			vertexBuffers.add( bufferAttribute );

		}

		this.attributes = attributes;
		this.vertexBuffers = Array.from( vertexBuffers.values() );

		return attributes;

	}

	getVertexBuffers() {

		if ( this.vertexBuffers === null ) this.getAttributes();

		return this.vertexBuffers;

	}

	getMaterialCacheKey() {

		const { object, material } = this;

		let cacheKey = material.customProgramCacheKey();

		for ( const property in material ) {

			if ( /^(is[A-Z])|^(visible|version|uuid|name|opacity|userData)$/.test( property ) ) continue;

			let value = material[ property ];

			if ( value !== null ) {

				const type = typeof value;

				if ( type === 'number' ) value = value !== 0 ? '1' : '0'; // Convert to on/off, important for clearcoat, transmission, etc
				else if ( type === 'object' ) value = '{}';

			}

			cacheKey += /*property + ':' +*/ value + ',';

		}

		cacheKey += this.clippingContextVersion + ',';

		if ( object.skeleton ) {

			cacheKey += object.skeleton.bones.length + ',';

		}

		if ( object.morphTargetInfluences ) {

			cacheKey += object.morphTargetInfluences.length + ',';

		}

		return cacheKey;

	}

	get needsUpdate() {

		return this.initialNodesCacheKey !== this.getNodesCacheKey();

	}

	getNodesCacheKey() {

		// Environment Nodes Cache Key

		return this._nodes.getCacheKey( this.scene, this.lightsNode );

	}

	getCacheKey() {

		return this.getMaterialCacheKey() + ',' + this.getNodesCacheKey();

	}

	dispose() {

		this.material.removeEventListener( 'dispose', this.onMaterialDispose );

		this.onDispose();

	}

}
