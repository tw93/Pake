(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('three'), require('three-mesh-bvh'), require('three/examples/jsm/postprocessing/Pass.js')) :
	typeof define === 'function' && define.amd ? define(['exports', 'three', 'three-mesh-bvh', 'three/examples/jsm/postprocessing/Pass.js'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.ThreePathTracer = global.ThreePathTracer || {}, global.THREE, global.MeshBVHLib, global.THREE));
})(this, (function (exports, three, threeMeshBvh, Pass_js) { 'use strict';

	// target offset is the number of elements in the target buffer stride to skip before copying the
	// attributes contents in to.
	function copyAttributeContents( attr, target, targetOffset = 0 ) {

		if ( attr.isInterleavedBufferAttribute ) {

			const itemSize = attr.itemSize;
			for ( let i = 0, l = attr.count; i < l; i ++ ) {

				const io = i + targetOffset;
				target.setX( io, attr.getX( i ) );
				if ( itemSize >= 2 ) target.setY( io, attr.getY( i ) );
				if ( itemSize >= 3 ) target.setZ( io, attr.getZ( i ) );
				if ( itemSize >= 4 ) target.setW( io, attr.getW( i ) );

			}

		} else {

			const array = target.array;
			const cons = array.constructor;
			const byteOffset = array.BYTES_PER_ELEMENT * attr.itemSize * targetOffset;
			const temp = new cons( array.buffer, byteOffset, attr.array.length );
			temp.set( attr.array );

		}

	}

	// Clones the given attribute with a new compatible buffer attribute but no data
	function createAttributeClone( attr, countOverride = null ) {

		const cons = attr.array.constructor;
		const normalized = attr.normalized;
		const itemSize = attr.itemSize;
		const count = countOverride === null ? attr.count : countOverride;

		return new three.BufferAttribute( new cons( itemSize * count ), itemSize, normalized );

	}

	// Confirms that the two provided attributes are compatible. Returns false if they are not.
	function validateAttributes( attr1, attr2 ) {

		if ( ! attr1 && ! attr2 ) {

			return true;

		}

		if ( Boolean( attr1 ) !== Boolean( attr2 ) ) {

			return false;

		}

		const sameCount = attr1.count === attr2.count;
		const sameNormalized = attr1.normalized === attr2.normalized;
		const sameType = attr1.array.constructor === attr2.array.constructor;
		const sameItemSize = attr1.itemSize === attr2.itemSize;

		if ( ! sameCount || ! sameNormalized || ! sameType || ! sameItemSize ) {

			return false;

		}

		return true;

	}

	function validateMergeability( geometries ) {

		const isIndexed = geometries[ 0 ].index !== null;
		const attributesUsed = new Set( Object.keys( geometries[ 0 ].attributes ) );
		if ( ! geometries[ 0 ].getAttribute( 'position' ) ) {

			throw new Error( 'StaticGeometryGenerator: position attribute is required.' );

		}

		for ( let i = 0; i < geometries.length; ++ i ) {

			const geometry = geometries[ i ];
			let attributesCount = 0;

			// ensure that all geometries are indexed, or none
			if ( isIndexed !== ( geometry.index !== null ) ) {

				throw new Error( 'StaticGeometryGenerator: All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them.' );

			}

			// gather attributes, exit early if they're different
			for ( const name in geometry.attributes ) {

				if ( ! attributesUsed.has( name ) ) {

					throw new Error( 'StaticGeometryGenerator: All geometries must have compatible attributes; make sure "' + name + '" attribute exists among all geometries, or in none of them.' );

				}

				attributesCount ++;

			}

			// ensure geometries have the same number of attributes
			if ( attributesCount !== attributesUsed.size ) {

				throw new Error( 'StaticGeometryGenerator: All geometries must have the same number of attributes.' );

			}

		}

	}

	function getTotalIndexCount( geometries ) {

		let result = 0;
		for ( let i = 0, l = geometries.length; i < l; i ++ ) {

			result += geometries[ i ].getIndex().count;

		}

		return result;

	}

	function getTotalAttributeCount( geometries ) {

		let result = 0;
		for ( let i = 0, l = geometries.length; i < l; i ++ ) {

			result += geometries[ i ].getAttribute( 'position' ).count;

		}

		return result;

	}

	function trimMismatchedAttributes( target, indexCount, attrCount ) {

		if ( target.index && target.index.count !== indexCount ) {

			target.setIndex( null );

		}

		const attributes = target.attributes;
		for ( const key in attributes ) {

			const attr = attributes[ key ];
			if ( attr.count !== attrCount ) {

				target.deleteAttribute( key );

			}

		}

	}

	// Modified version of BufferGeometryUtils.mergeBufferGeometries that ignores morph targets and updates a attributes in place
	function mergeGeometries( geometries, options = {}, targetGeometry = new three.BufferGeometry() ) {

		const {
			useGroups = false,
			forceUpdate = false,
			skipAssigningAttributes = [],
			overwriteIndex = true,
		} = options;

		// check if we can merge these geometries
		validateMergeability( geometries );

		const isIndexed = geometries[ 0 ].index !== null;
		const totalIndexCount = isIndexed ? getTotalIndexCount( geometries ) : - 1;
		const totalAttributeCount = getTotalAttributeCount( geometries );
		trimMismatchedAttributes( targetGeometry, totalIndexCount, totalAttributeCount );

		// set up groups
		if ( useGroups ) {

			let offset = 0;
			for ( let i = 0, l = geometries.length; i < l; i ++ ) {

				const geometry = geometries[ i ];

				let primitiveCount;
				if ( isIndexed ) {

					primitiveCount = geometry.getIndex().count;

				} else {

					primitiveCount = geometry.getAttribute( 'position' ).count;

				}

				targetGeometry.addGroup( offset, primitiveCount, i );
				offset += primitiveCount;

			}

		}

		// generate the final geometry
		// skip the assigning any attributes for items in the above array
		if ( isIndexed ) {

			// set up the index if it doesn't exist
			let forceUpdateIndex = false;
			if ( ! targetGeometry.index ) {

				targetGeometry.setIndex( new three.BufferAttribute( new Uint32Array( totalIndexCount ), 1, false ) );
				forceUpdateIndex = true;

			}

			if ( forceUpdateIndex || overwriteIndex ) {

				// copy the index data to the target geometry
				let targetOffset = 0;
				let indexOffset = 0;
				const targetIndex = targetGeometry.getIndex();
				for ( let i = 0, l = geometries.length; i < l; i ++ ) {

					const geometry = geometries[ i ];
					const index = geometry.getIndex();
					const skip = ! forceUpdate && ! forceUpdateIndex && skipAssigningAttributes[ i ];
					if ( ! skip ) {

						for ( let j = 0; j < index.count; ++ j ) {

							targetIndex.setX( targetOffset + j, index.getX( j ) + indexOffset );

						}

					}

					targetOffset += index.count;
					indexOffset += geometry.getAttribute( 'position' ).count;

				}

			}

		}

		// copy all the attribute data over
		const attributes = Object.keys( geometries[ 0 ].attributes );
		for ( let i = 0, l = attributes.length; i < l; i ++ ) {

			let forceUpdateAttr = false;
			const key = attributes[ i ];
			if ( ! targetGeometry.getAttribute( key ) ) {

				const firstAttr = geometries[ 0 ].getAttribute( key );
				targetGeometry.setAttribute( key, createAttributeClone( firstAttr, totalAttributeCount ) );
				forceUpdateAttr = true;

			}

			let offset = 0;
			const targetAttribute = targetGeometry.getAttribute( key );
			for ( let g = 0, l = geometries.length; g < l; g ++ ) {

				const geometry = geometries[ g ];
				const skip = ! forceUpdate && ! forceUpdateAttr && skipAssigningAttributes[ g ];
				const attr = geometry.getAttribute( key );
	 			if ( ! skip ) {

					copyAttributeContents( attr, targetAttribute, offset );

				}

				offset += attr.count;

			}

		}

	}

	function updateMaterialIndexAttribute( geometry, materials, allMaterials ) {

		const indexAttr = geometry.index;
		const posAttr = geometry.attributes.position;
		const vertCount = posAttr.count;
		const totalCount = indexAttr ? indexAttr.count : vertCount;
		let groups = geometry.groups;
		if ( groups.length === 0 ) {

			groups = [ { count: totalCount, start: 0, materialIndex: 0 } ];

		}

		let materialIndexAttribute = geometry.getAttribute( 'materialIndex' );
		if ( ! materialIndexAttribute || materialIndexAttribute.count !== vertCount ) {

			// use an array with the minimum precision required to store all material id references.
			let array;
			if ( allMaterials.length <= 255 ) {

				array = new Uint8Array( vertCount );

			} else {

				array = new Uint16Array( vertCount );

			}

			materialIndexAttribute = new three.BufferAttribute( array, 1, false );
			geometry.deleteAttribute( 'materialIndex' );
			geometry.setAttribute( 'materialIndex', materialIndexAttribute );

		}

		const materialArray = materialIndexAttribute.array;
		for ( let i = 0; i < groups.length; i ++ ) {

			const group = groups[ i ];
			const start = group.start;
			const count = group.count;
			const endCount = Math.min( count, totalCount - start );

			const mat = Array.isArray( materials ) ? materials[ group.materialIndex ] : materials;
			const materialIndex = allMaterials.indexOf( mat );

			for ( let j = 0; j < endCount; j ++ ) {

				let index = start + j;
				if ( indexAttr ) {

					index = indexAttr.getX( index );

				}

				materialArray[ index ] = materialIndex;

			}

		}

	}

	function setCommonAttributes( geometry, attributes ) {

		if ( ! geometry.index ) {

			// TODO: compute a typed array
			const indexCount = geometry.attributes.position.count;
			const array = new Array( indexCount );
			for ( let i = 0; i < indexCount; i ++ ) {

				array[ i ] = i;

			}

			geometry.setIndex( array );

		}

		if ( ! geometry.attributes.normal && ( attributes && attributes.includes( 'normal' ) ) ) {

			geometry.computeVertexNormals();

		}

		if ( ! geometry.attributes.uv && ( attributes && attributes.includes( 'uv' ) ) ) {

			const vertCount = geometry.attributes.position.count;
			geometry.setAttribute( 'uv', new three.BufferAttribute( new Float32Array( vertCount * 2 ), 2, false ) );

		}

		if ( ! geometry.attributes.uv2 && ( attributes && attributes.includes( 'uv2' ) ) ) {

			const vertCount = geometry.attributes.position.count;
			geometry.setAttribute( 'uv2', new three.BufferAttribute( new Float32Array( vertCount * 2 ), 2, false ) );

		}

		if ( ! geometry.attributes.tangent && ( attributes && attributes.includes( 'tangent' ) ) ) {

			// compute tangents requires a uv and normal buffer
			if ( geometry.attributes.uv && geometry.attributes.normal ) {

				geometry.computeTangents();

			} else {

				const vertCount = geometry.attributes.position.count;
				geometry.setAttribute( 'tangent', new three.BufferAttribute( new Float32Array( vertCount * 4 ), 4, false ) );

			}

		}

		if ( ! geometry.attributes.color && ( attributes && attributes.includes( 'color' ) ) ) {

			const vertCount = geometry.attributes.position.count;
			const array = new Float32Array( vertCount * 4 );
			array.fill( 1.0 );
			geometry.setAttribute( 'color', new three.BufferAttribute( array, 4 ) );

		}

	}

	// https://www.geeksforgeeks.org/how-to-create-hash-from-string-in-javascript/
	// https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
	function bufferToHash( buffer ) {

		let hash = 0;

		if ( buffer.byteLength !== 0 ) {

			const uintArray = new Uint8Array( buffer );
			for ( let i = 0; i < buffer.byteLength; i ++ ) {

				const byte = uintArray[ i ];
				hash = ( ( hash << 5 ) - hash ) + byte;
				hash |= 0;

			}

		}

		return hash;

	}

	function getGeometryHash( geometry ) {

		let hash = geometry.uuid;
		const attributes = Object.values( geometry.attributes );
		if ( geometry.index ) {

			attributes.push( geometry.index );
			hash += `index|${ geometry.index.version }`;

		}

		const keys = Object.keys( attributes ).sort();
		for ( const key of keys ) {

			const attr = attributes[ key ];
			hash += `${ key }_${ attr.version }|`;

		}

		return hash;

	}

	function getSkeletonHash( mesh ) {

		const skeleton = mesh.skeleton;
		if ( skeleton ) {

			if ( ! skeleton.boneTexture ) {

				skeleton.computeBoneTexture();

			}

			// we can't use the texture version here because it will change even
			// when the bones haven't
			const dataHash = bufferToHash( skeleton.boneTexture.image.data.buffer );
			return `${ dataHash }_${ skeleton.boneTexture.uuid }`;

		} else {

			return null;

		}

	}

	// Checks whether the geometry changed between this and last evaluation
	class MeshDiff {

		constructor( mesh = null ) {

			this.matrixWorld = new three.Matrix4();
			this.geometryHash = null;
			this.skeletonHash = null;
			this.primitiveCount = - 1;

			if ( mesh !== null ) {

				this.updateFrom( mesh );

			}

		}

		updateFrom( mesh ) {

			const geometry = mesh.geometry;
			const primitiveCount = ( geometry.index ? geometry.index.count : geometry.attributes.position.count ) / 3;
			this.matrixWorld.copy( mesh.matrixWorld );
			this.geometryHash = getGeometryHash( geometry );
			this.primitiveCount = primitiveCount;
			this.skeletonHash = getSkeletonHash( mesh );

		}

		didChange( mesh ) {

			const geometry = mesh.geometry;
			const primitiveCount = ( geometry.index ? geometry.index.count : geometry.attributes.position.count ) / 3;

			const identical =
				this.matrixWorld.equals( mesh.matrixWorld ) &&
				this.geometryHash === getGeometryHash( geometry ) &&
				this.skeletonHash === getSkeletonHash( mesh ) &&
				this.primitiveCount === primitiveCount;

			return ! identical;

		}

	}

	const _positionVector = /*@__PURE__*/ new three.Vector3();
	const _normalVector = /*@__PURE__*/ new three.Vector3();
	const _tangentVector = /*@__PURE__*/ new three.Vector3();
	const _tangentVector4 = /*@__PURE__*/ new three.Vector4();

	const _morphVector = /*@__PURE__*/ new three.Vector3();
	const _temp = /*@__PURE__*/ new three.Vector3();

	const _skinIndex = /*@__PURE__*/ new three.Vector4();
	const _skinWeight = /*@__PURE__*/ new three.Vector4();
	const _matrix = /*@__PURE__*/ new three.Matrix4();
	const _boneMatrix = /*@__PURE__*/ new three.Matrix4();

	// A version of "SkinnedMesh.boneTransform" for normals
	function boneNormalTransform( mesh, index, target ) {

		const skeleton = mesh.skeleton;
		const geometry = mesh.geometry;
		const bones = skeleton.bones;
		const boneInverses = skeleton.boneInverses;

		_skinIndex.fromBufferAttribute( geometry.attributes.skinIndex, index );
		_skinWeight.fromBufferAttribute( geometry.attributes.skinWeight, index );

		_matrix.elements.fill( 0 );

		for ( let i = 0; i < 4; i ++ ) {

			const weight = _skinWeight.getComponent( i );

			if ( weight !== 0 ) {

				const boneIndex = _skinIndex.getComponent( i );
				_boneMatrix.multiplyMatrices( bones[ boneIndex ].matrixWorld, boneInverses[ boneIndex ] );

				addScaledMatrix( _matrix, _boneMatrix, weight );

			}

		}

		_matrix.multiply( mesh.bindMatrix ).premultiply( mesh.bindMatrixInverse );
		target.transformDirection( _matrix );

		return target;

	}

	// Applies the morph target data to the target vector
	function applyMorphTarget( morphData, morphInfluences, morphTargetsRelative, i, target ) {

		_morphVector.set( 0, 0, 0 );
		for ( let j = 0, jl = morphData.length; j < jl; j ++ ) {

			const influence = morphInfluences[ j ];
			const morphAttribute = morphData[ j ];

			if ( influence === 0 ) continue;

			_temp.fromBufferAttribute( morphAttribute, i );

			if ( morphTargetsRelative ) {

				_morphVector.addScaledVector( _temp, influence );

			} else {

				_morphVector.addScaledVector( _temp.sub( target ), influence );

			}

		}

		target.add( _morphVector );

	}

	// Adds the "matrix" multiplied by "scale" to "target"
	function addScaledMatrix( target, matrix, scale ) {

		const targetArray = target.elements;
		const matrixArray = matrix.elements;
		for ( let i = 0, l = matrixArray.length; i < l; i ++ ) {

			targetArray[ i ] += matrixArray[ i ] * scale;

		}

	}

	// inverts the geometry in place
	function invertGeometry( geometry ) {

		const { index, attributes } = geometry;
		if ( index ) {

			for ( let i = 0, l = index.count; i < l; i += 3 ) {

				const v0 = index.getX( i );
				const v2 = index.getX( i + 2 );
				index.setX( i, v2 );
				index.setX( i + 2, v0 );

			}

		} else {

			for ( const key in attributes ) {

				const attr = attributes[ key ];
				const itemSize = attr.itemSize;
				for ( let i = 0, l = attr.count; i < l; i += 3 ) {

					for ( let j = 0; j < itemSize; j ++ ) {

						const v0 = attr.getComponent( i, j );
						const v2 = attr.getComponent( i + 2, j );
						attr.setComponent( i, j, v2 );
						attr.setComponent( i + 2, j, v0 );

					}

				}

			}

		}

		return geometry;

	}

	function convertToStaticGeometry( mesh, options = {}, targetGeometry = new three.BufferGeometry() ) {

		options = {
			applyWorldTransforms: true,
			attributes: [],
			...options
		};

		const geometry = mesh.geometry;
		const applyWorldTransforms = options.applyWorldTransforms;
		const includeNormal = options.attributes.includes( 'normal' );
		const includeTangent = options.attributes.includes( 'tangent' );
		const attributes = geometry.attributes;
		const targetAttributes = targetGeometry.attributes;

		// strip any unused and unneeded attributes
		for ( const key in targetGeometry.attributes ) {

			if ( ! options.attributes.includes( key ) || ! ( key in geometry.attributes ) ) {

				targetGeometry.deleteAttribute( key );

			}

		}

		// initialize the attributes if they don't exist
		if ( ! targetGeometry.index && geometry.index ) {

			targetGeometry.index = geometry.index.clone();

		}

		if ( ! targetAttributes.position ) {

			targetGeometry.setAttribute( 'position', createAttributeClone( attributes.position ) );

		}

		if ( includeNormal && ! targetAttributes.normal && attributes.normal ) {

			targetGeometry.setAttribute( 'normal', createAttributeClone( attributes.normal ) );

		}

		if ( includeTangent && ! targetAttributes.tangent && attributes.tangent ) {

			targetGeometry.setAttribute( 'tangent', createAttributeClone( attributes.tangent ) );

		}

		// ensure the attributes are consistent
		validateAttributes( geometry.index, targetGeometry.index );
		validateAttributes( attributes.position, targetAttributes.position );

		if ( includeNormal ) {

			validateAttributes( attributes.normal, targetAttributes.normal );

		}

		if ( includeTangent ) {

			validateAttributes( attributes.tangent, targetAttributes.tangent );

		}

		// generate transformed vertex attribute data
		const position = attributes.position;
		const normal = includeNormal ? attributes.normal : null;
		const tangent = includeTangent ? attributes.tangent : null;
		const morphPosition = geometry.morphAttributes.position;
		const morphNormal = geometry.morphAttributes.normal;
		const morphTangent = geometry.morphAttributes.tangent;
		const morphTargetsRelative = geometry.morphTargetsRelative;
		const morphInfluences = mesh.morphTargetInfluences;
		const normalMatrix = new three.Matrix3();
		normalMatrix.getNormalMatrix( mesh.matrixWorld );

		// copy the index
		if ( geometry.index ) {

			targetGeometry.index.array.set( geometry.index.array );

		}

		// copy and apply other attributes
		for ( let i = 0, l = attributes.position.count; i < l; i ++ ) {

			_positionVector.fromBufferAttribute( position, i );
			if ( normal ) {

				_normalVector.fromBufferAttribute( normal, i );

			}

			if ( tangent ) {

				_tangentVector4.fromBufferAttribute( tangent, i );
				_tangentVector.fromBufferAttribute( tangent, i );

			}

			// apply morph target transform
			if ( morphInfluences ) {

				if ( morphPosition ) {

					applyMorphTarget( morphPosition, morphInfluences, morphTargetsRelative, i, _positionVector );

				}

				if ( morphNormal ) {

					applyMorphTarget( morphNormal, morphInfluences, morphTargetsRelative, i, _normalVector );

				}

				if ( morphTangent ) {

					applyMorphTarget( morphTangent, morphInfluences, morphTargetsRelative, i, _tangentVector );

				}

			}

			// apply bone transform
			if ( mesh.isSkinnedMesh ) {

				mesh.applyBoneTransform( i, _positionVector );
				if ( normal ) {

					boneNormalTransform( mesh, i, _normalVector );

				}

				if ( tangent ) {

					boneNormalTransform( mesh, i, _tangentVector );

				}

			}

			// update the vectors of the attributes
			if ( applyWorldTransforms ) {

				_positionVector.applyMatrix4( mesh.matrixWorld );

			}

			targetAttributes.position.setXYZ( i, _positionVector.x, _positionVector.y, _positionVector.z );

			if ( normal ) {

				if ( applyWorldTransforms ) {

					_normalVector.applyNormalMatrix( normalMatrix );

				}

				targetAttributes.normal.setXYZ( i, _normalVector.x, _normalVector.y, _normalVector.z );

			}

			if ( tangent ) {

				if ( applyWorldTransforms ) {

					_tangentVector.transformDirection( mesh.matrixWorld );

				}

				targetAttributes.tangent.setXYZW( i, _tangentVector.x, _tangentVector.y, _tangentVector.z, _tangentVector4.w );

			}

		}

		// copy other attributes over
		for ( const i in options.attributes ) {

			const key = options.attributes[ i ];
			if ( key === 'position' || key === 'tangent' || key === 'normal' || ! ( key in attributes ) ) {

				continue;

			}

			if ( ! targetAttributes[ key ] ) {

				targetGeometry.setAttribute( key, createAttributeClone( attributes[ key ] ) );

			}

			validateAttributes( attributes[ key ], targetAttributes[ key ] );
			copyAttributeContents( attributes[ key ], targetAttributes[ key ] );

		}

		if ( mesh.matrixWorld.determinant() < 0 ) {

			invertGeometry( targetGeometry );

		}

		return targetGeometry;

	}

	class BakedGeometry extends three.BufferGeometry {

		constructor() {

			super();
			this.version = 0;
			this.hash = null;
			this._diff = new MeshDiff();

		}

		// returns whether the passed mesh is compatible with this baked geometry
		// such that it can be updated without resizing attributes
		isCompatible( mesh, attributes ) {

			const geometry = mesh.geometry;
			for ( let i = 0; i < attributes.length; i ++ ) {

				const key = attributes[ i ];
				const attr1 = geometry.attributes[ key ];
				const attr2 = this.attributes[ key ];
				if ( attr1 && ! validateAttributes( attr1, attr2 ) ) {

					return false;

				}

			}

			return true;

		}

		updateFrom( mesh, options ) {

			const diff = this._diff;
			if ( diff.didChange( mesh ) ) {

				convertToStaticGeometry( mesh, options, this );
				diff.updateFrom( mesh );
				this.version ++;
				this.hash = `${ this.uuid }_${ this.version }`;
				return true;

			} else {

				return false;

			}

		}

	}

	const NO_CHANGE = 0;
	const GEOMETRY_ADJUSTED = 1;
	const GEOMETRY_REBUILT = 2;

	// iterate over only the meshes in the provided objects
	function flatTraverseMeshes( objects, cb ) {

		for ( let i = 0, l = objects.length; i < l; i ++ ) {

			const object = objects[ i ];
			object.traverseVisible( o => {

				if ( o.isMesh ) {

					cb( o );

				}

			} );

		}

	}

	// return the set of materials used by the provided meshes
	function getMaterials( meshes ) {

		const materials = [];
		for ( let i = 0, l = meshes.length; i < l; i ++ ) {

			const mesh = meshes[ i ];
			if ( Array.isArray( mesh.material ) ) {

				materials.push( ...mesh.material );

			} else {

				materials.push( mesh.material );

			}

		}

		return materials;

	}

	function mergeGeometryList( geometries, target, options ) {

		// If we have no geometry to merge then provide an empty geometry.
		if ( geometries.length === 0 ) {

			// if there are no geometries then just create a fake empty geometry to provide
			target.setIndex( null );

			// remove all geometry
			const attrs = target.attributes;
			for ( const key in attrs ) {

				target.deleteAttribute( key );

			}

			// create dummy attributes
			for ( const key in options.attributes ) {

				target.setAttribute( options.attributes[ key ], new three.BufferAttribute( new Float32Array( 0 ), 4, false ) );

			}

		} else {

			mergeGeometries( geometries, options, target );

		}

		// Mark all attributes as needing an update
		for ( const key in target.attributes ) {

			target.attributes[ key ].needsUpdate = true;

		}

	}


	class StaticGeometryGenerator {

		constructor( objects ) {

			this.objects = null;
			this.useGroups = true;
			this.applyWorldTransforms = true;
			this.generateMissingAttributes = true;
			this.overwriteIndex = true;
			this.attributes = [ 'position', 'normal', 'color', 'tangent', 'uv', 'uv2' ];
			this._intermediateGeometry = new Map();
			this._geometryMergeSets = new WeakMap();
			this._mergeOrder = [];
			this._dummyMesh = null;

			this.setObjects( objects || [] );

		}

		_getDummyMesh() {

			// return a consistent dummy mesh
			if ( ! this._dummyMesh ) {

				const dummyMaterial = new three.MeshBasicMaterial();
				const emptyGeometry = new three.BufferGeometry();
				emptyGeometry.setAttribute( 'position', new three.BufferAttribute( new Float32Array( 9 ), 3 ) );
				this._dummyMesh = new three.Mesh( emptyGeometry, dummyMaterial );

			}

			return this._dummyMesh;

		}

		_getMeshes() {

			// iterate over only the meshes in the provided objects
			const meshes = [];
			flatTraverseMeshes( this.objects, mesh => {

				meshes.push( mesh );

			} );

			// Sort the geometry so it's in a reliable order
			meshes.sort( ( a, b ) => {

				if ( a.uuid > b.uuid ) return 1;
				if ( a.uuid < b.uuid ) return - 1;
				return 0;

			} );

			if ( meshes.length === 0 ) {

				meshes.push( this._getDummyMesh() );

			}

			return meshes;

		}

		_updateIntermediateGeometries() {

			const { _intermediateGeometry } = this;

			const meshes = this._getMeshes();
			const unusedMeshKeys = new Set( _intermediateGeometry.keys() );
			const convertOptions = {
				attributes: this.attributes,
				applyWorldTransforms: this.applyWorldTransforms,
			};

			for ( let i = 0, l = meshes.length; i < l; i ++ ) {

				const mesh = meshes[ i ];
				const meshKey = mesh.uuid;
				unusedMeshKeys.delete( meshKey );

				// initialize the intermediate geometry
				// if the mesh and source geometry have changed in such a way that they are no longer
				// compatible then regenerate the baked geometry from scratch
				let geom = _intermediateGeometry.get( meshKey );
				if ( ! geom || ! geom.isCompatible( mesh, this.attributes ) ) {

					if ( geom ) {

						geom.dispose();

					}

					geom = new BakedGeometry();
					_intermediateGeometry.set( meshKey, geom );

				}

				// transform the geometry into the intermediate buffer geometry, saving whether
				// or not it changed.
				if ( geom.updateFrom( mesh, convertOptions ) ) {

					// TODO: provide option for only generating the set of attributes that are present
					// and are in the attributes array
					if ( this.generateMissingAttributes ) {

						setCommonAttributes( geom, this.attributes );

					}

				}

			}

			unusedMeshKeys.forEach( key => {

				_intermediateGeometry.delete( key );

			} );

		}

		setObjects( objects ) {

			if ( Array.isArray( objects ) ) {

				this.objects = [ ...objects ];

			} else {

				this.objects = [ objects ];

			}

		}

		generate( targetGeometry = new three.BufferGeometry() ) {

			// track which attributes have been updated and which to skip to avoid unnecessary attribute copies
			const { useGroups, overwriteIndex, _intermediateGeometry, _geometryMergeSets } = this;

			const meshes = this._getMeshes();
			const skipAssigningAttributes = [];
			const mergeGeometry = [];
			const previousMergeInfo = _geometryMergeSets.get( targetGeometry ) || [];

			// update all the intermediate static geometry representations
			this._updateIntermediateGeometries();

			// get the list of geometries to merge
			let forceUpdate = false;
			if ( meshes.length !== previousMergeInfo.length ) {

				forceUpdate = true;

			}

			for ( let i = 0, l = meshes.length; i < l; i ++ ) {

				const mesh = meshes[ i ];
				const geom = _intermediateGeometry.get( mesh.uuid );
				mergeGeometry.push( geom );

				const info = previousMergeInfo[ i ];
				if ( ! info || info.uuid !== geom.uuid ) {

					skipAssigningAttributes.push( false );
					forceUpdate = true;

				} else if ( info.version !== geom.version ) {

					skipAssigningAttributes.push( false );

				} else {

					skipAssigningAttributes.push( true );

				}

			}

			// If we have no geometry to merge then provide an empty geometry.
			mergeGeometryList( mergeGeometry, targetGeometry, { useGroups, forceUpdate, skipAssigningAttributes, overwriteIndex } );

			// force update means the attribute buffer lengths have changed
			if ( forceUpdate ) {

				targetGeometry.dispose();

			}

			_geometryMergeSets.set( targetGeometry, mergeGeometry.map( g => ( {
				version: g.version,
				uuid: g.uuid,
			} ) ) );

			let changeType = NO_CHANGE;
			if ( forceUpdate ) changeType = GEOMETRY_REBUILT;
			else if ( skipAssigningAttributes.includes( false ) ) changeType = GEOMETRY_ADJUSTED;

			return {
				changeType,
				materials: getMaterials( meshes ),
				geometry: targetGeometry,
			};

		}

	}

	// collect the textures from the materials
	function getTextures$1( materials ) {

		const textureSet = new Set();
		for ( let i = 0, l = materials.length; i < l; i ++ ) {

			const material = materials[ i ];
			for ( const key in material ) {

				const value = material[ key ];
				if ( value && value.isTexture ) {

					textureSet.add( value );

				}

			}

		}

		return Array.from( textureSet );

	}

	// collect the lights in the scene
	function getLights$1( objects ) {

		const lights = [];
		const iesSet = new Set();
		for ( let i = 0, l = objects.length; i < l; i ++ ) {

			objects[ i ].traverse( c => {

				if ( c.visible ) {

					if (
						c.isRectAreaLight ||
						c.isSpotLight ||
						c.isPointLight ||
						c.isDirectionalLight
					) {

						lights.push( c );

						if ( c.iesMap ) {

							iesSet.add( c.iesMap );

						}

					}

				}

			} );

		}

		const iesTextures = Array.from( iesSet ).sort( ( a, b ) => {

			if ( a.uuid < b.uuid ) return 1;
			if ( a.uuid > b.uuid ) return - 1;
			return 0;

		} );

		return { lights, iesTextures };

	}

	class PathTracingSceneGenerator {

		get initialized() {

			return Boolean( this.bvh );

		}

		constructor( objects ) {

			// options
			this.bvhOptions = {};
			this.attributes = [ 'position', 'normal', 'tangent', 'color', 'uv', 'uv2' ];
			this.generateBVH = true;

			// state
			this.bvh = null;
			this.geometry = new three.BufferGeometry();
			this.staticGeometryGenerator = new StaticGeometryGenerator( objects );
			this._bvhWorker = null;
			this._pendingGenerate = null;
			this._buildAsync = false;

		}

		setObjects( objects ) {

			this.staticGeometryGenerator.setObjects( objects );

		}

		setBVHWorker( bvhWorker ) {

			this._bvhWorker = bvhWorker;

		}

		async generateAsync( onProgress = null ) {

			if ( ! this._bvhWorker ) {

				throw new Error( 'PathTracingSceneGenerator: "setBVHWorker" must be called before "generateAsync" can be called.' );

			}

			if ( this.bvh instanceof Promise ) {

				// if a bvh is already being generated we can wait for that to finish
				// and build another with the latest data while sharing the results.
				if ( ! this._pendingGenerate ) {

					this._pendingGenerate = new Promise( async () => {

						await this.bvh;
						this._pendingGenerate = null;

						// TODO: support multiple callbacks queued?
						return this.generateAsync( onProgress );

					} );

				}

				return this._pendingGenerate;

			} else {

				this._buildAsync = true;
				const result = this.generate( onProgress );
				this._buildAsync = false;

				result.bvh = this.bvh = await result.bvh;
				return result;

			}

		}

		generate( onProgress = null ) {

			const { staticGeometryGenerator, geometry, attributes } = this;
			const objects = staticGeometryGenerator.objects;
			staticGeometryGenerator.attributes = attributes;

			// update the skeleton animations in case WebGLRenderer is not running
			// to update it.
			objects.forEach( o => {

				o.traverse( c => {

					if ( c.isSkinnedMesh && c.skeleton ) {

						c.skeleton.update();

					}

				} );

			} );

			// generate the geometry
			const result = staticGeometryGenerator.generate( geometry );
			const materials = result.materials;
			const textures = getTextures$1( materials );
			const { lights, iesTextures } = getLights$1( objects );

			if ( result.changeType !== NO_CHANGE ) {

				updateMaterialIndexAttribute( geometry, materials, materials );

			}

			// only generate a new bvh if the objects used have changed
			if ( this.generateBVH ) {

				if ( this.bvh instanceof Promise ) {

					throw new Error( 'PathTracingSceneGenerator: BVH is already building asynchronously.' );

				}

				if ( result.changeType === GEOMETRY_REBUILT ) {

					const bvhOptions = {
						strategy: threeMeshBvh.SAH,
						maxLeafTris: 1,
						indirect: true,
						onProgress,
						...this.bvhOptions,
					};

					if ( this._buildAsync ) {

						this.bvh = this._bvhWorker.generate( geometry, bvhOptions );

					} else {

						this.bvh = new threeMeshBvh.MeshBVH( geometry, bvhOptions );

					}

				} else if ( result.changeType === GEOMETRY_ADJUSTED ) {

					this.bvh.refit();

				}

			}

			return {
				bvhChanged: result.changeType !== NO_CHANGE,
				bvh: this.bvh,
				lights,
				iesTextures,
				geometry,
				materials,
				textures,
				objects,
			};

		}

	}

	class DynamicPathTracingSceneGenerator extends PathTracingSceneGenerator {

		constructor( ...args ) {

			super( ...args );
			console.warn( 'DynamicPathTracingSceneGenerator has been deprecated and renamed to "PathTracingSceneGenerator".' );

		}

	}

	class PathTracingSceneWorker extends PathTracingSceneGenerator {

		constructor( ...args ) {

			super( ...args );
			console.warn( 'PathTracingSceneWorker has been deprecated and renamed to "PathTracingSceneGenerator".' );

		}

	}

	class MaterialBase extends three.ShaderMaterial {

		set needsUpdate( v ) {

			super.needsUpdate = true;
			this.dispatchEvent( {

				type: 'recompilation',

			} );

		}

		constructor( shader ) {

			super( shader );

			for ( const key in this.uniforms ) {

				Object.defineProperty( this, key, {

					get() {

						return this.uniforms[ key ].value;

					},

					set( v ) {

						this.uniforms[ key ].value = v;

					}

				} );

			}

		}

		// sets the given named define value and sets "needsUpdate" to true if it's different
		setDefine( name, value = undefined ) {

			if ( value === undefined || value === null ) {

				if ( name in this.defines ) {

					delete this.defines[ name ];
					this.needsUpdate = true;
					return true;

				}

			} else {

				if ( this.defines[ name ] !== value ) {

					this.defines[ name ] = value;
					this.needsUpdate = true;
					return true;

				}

			}

			return false;

		}

	}

	class BlendMaterial extends MaterialBase {

		constructor( parameters ) {

			super( {

				blending: three.NoBlending,

				uniforms: {

					target1: { value: null },
					target2: { value: null },
					opacity: { value: 1.0 },

				},

				vertexShader: /* glsl */`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,

				fragmentShader: /* glsl */`

				uniform float opacity;

				uniform sampler2D target1;
				uniform sampler2D target2;

				varying vec2 vUv;

				void main() {

					vec4 color1 = texture2D( target1, vUv );
					vec4 color2 = texture2D( target2, vUv );

					float invOpacity = 1.0 - opacity;
					float totalAlpha = color1.a * invOpacity + color2.a * opacity;

					if ( color1.a != 0.0 || color2.a != 0.0 ) {

						gl_FragColor.rgb = color1.rgb * ( invOpacity * color1.a / totalAlpha ) + color2.rgb * ( opacity * color2.a / totalAlpha );
						gl_FragColor.a = totalAlpha;

					} else {

						gl_FragColor = vec4( 0.0 );

					}

				}`

			} );

			this.setValues( parameters );

		}

	}

	// References
	// - https://jcgt.org/published/0009/04/01/
	// - Code from https://www.shadertoy.com/view/WtGyDm

	// functions to generate multi-dimensions variables of the same functions
	// to support 1, 2, 3, and 4 dimensional sobol sampling.
	function generateSobolFunctionVariants( dim = 1 ) {

		let type = 'uint';
		if ( dim > 1 ) {

			type = 'uvec' + dim;

		}

		return /* glsl */`
		${ type } sobolReverseBits( ${ type } x ) {

			x = ( ( ( x & 0xaaaaaaaau ) >> 1 ) | ( ( x & 0x55555555u ) << 1 ) );
			x = ( ( ( x & 0xccccccccu ) >> 2 ) | ( ( x & 0x33333333u ) << 2 ) );
			x = ( ( ( x & 0xf0f0f0f0u ) >> 4 ) | ( ( x & 0x0f0f0f0fu ) << 4 ) );
			x = ( ( ( x & 0xff00ff00u ) >> 8 ) | ( ( x & 0x00ff00ffu ) << 8 ) );
			return ( ( x >> 16 ) | ( x << 16 ) );

		}

		${ type } sobolHashCombine( uint seed, ${ type } v ) {

			return seed ^ ( v + ${ type }( ( seed << 6 ) + ( seed >> 2 ) ) );

		}

		${ type } sobolLaineKarrasPermutation( ${ type } x, ${ type } seed ) {

			x += seed;
			x ^= x * 0x6c50b47cu;
			x ^= x * 0xb82f1e52u;
			x ^= x * 0xc7afe638u;
			x ^= x * 0x8d22f6e6u;
			return x;

		}

		${ type } nestedUniformScrambleBase2( ${ type } x, ${ type } seed ) {

			x = sobolLaineKarrasPermutation( x, seed );
			x = sobolReverseBits( x );
			return x;

		}
	`;

	}

	function generateSobolSampleFunctions( dim = 1 ) {

		let utype = 'uint';
		let vtype = 'float';
		let num = '';
		let components = '.r';
		let combineValues = '1u';
		if ( dim > 1 ) {

			utype = 'uvec' + dim;
			vtype = 'vec' + dim;
			num = dim + '';
			if ( dim === 2 ) {

				components = '.rg';
				combineValues = 'uvec2( 1u, 2u )';

			} else if ( dim === 3 ) {

				components = '.rgb';
				combineValues = 'uvec3( 1u, 2u, 3u )';

			} else {

				components = '';
				combineValues = 'uvec4( 1u, 2u, 3u, 4u )';

			}

		}

		return /* glsl */`

		${ vtype } sobol${ num }( int effect ) {

			uint seed = sobolGetSeed( sobolBounceIndex, uint( effect ) );
			uint index = sobolPathIndex;

			uint shuffle_seed = sobolHashCombine( seed, 0u );
			uint shuffled_index = nestedUniformScrambleBase2( sobolReverseBits( index ), shuffle_seed );
			${ vtype } sobol_pt = sobolGetTexturePoint( shuffled_index )${ components };
			${ utype } result = ${ utype }( sobol_pt * 16777216.0 );

			${ utype } seed2 = sobolHashCombine( seed, ${ combineValues } );
			result = nestedUniformScrambleBase2( result, seed2 );

			return SOBOL_FACTOR * ${ vtype }( result >> 8 );

		}
	`;

	}

	const sobol_common = /* glsl */`

	// Utils
	const float SOBOL_FACTOR = 1.0 / 16777216.0;
	const uint SOBOL_MAX_POINTS = 256u * 256u;

	${ generateSobolFunctionVariants( 1 ) }
	${ generateSobolFunctionVariants( 2 ) }
	${ generateSobolFunctionVariants( 3 ) }
	${ generateSobolFunctionVariants( 4 ) }

	uint sobolHash( uint x ) {

		// finalizer from murmurhash3
		x ^= x >> 16;
		x *= 0x85ebca6bu;
		x ^= x >> 13;
		x *= 0xc2b2ae35u;
		x ^= x >> 16;
		return x;

	}

`;

	const sobol_point_generation = /* glsl */`

	const uint SOBOL_DIRECTIONS_1[ 32 ] = uint[ 32 ](
		0x80000000u, 0xc0000000u, 0xa0000000u, 0xf0000000u,
		0x88000000u, 0xcc000000u, 0xaa000000u, 0xff000000u,
		0x80800000u, 0xc0c00000u, 0xa0a00000u, 0xf0f00000u,
		0x88880000u, 0xcccc0000u, 0xaaaa0000u, 0xffff0000u,
		0x80008000u, 0xc000c000u, 0xa000a000u, 0xf000f000u,
		0x88008800u, 0xcc00cc00u, 0xaa00aa00u, 0xff00ff00u,
		0x80808080u, 0xc0c0c0c0u, 0xa0a0a0a0u, 0xf0f0f0f0u,
		0x88888888u, 0xccccccccu, 0xaaaaaaaau, 0xffffffffu
	);

	const uint SOBOL_DIRECTIONS_2[ 32 ] = uint[ 32 ](
		0x80000000u, 0xc0000000u, 0x60000000u, 0x90000000u,
		0xe8000000u, 0x5c000000u, 0x8e000000u, 0xc5000000u,
		0x68800000u, 0x9cc00000u, 0xee600000u, 0x55900000u,
		0x80680000u, 0xc09c0000u, 0x60ee0000u, 0x90550000u,
		0xe8808000u, 0x5cc0c000u, 0x8e606000u, 0xc5909000u,
		0x6868e800u, 0x9c9c5c00u, 0xeeee8e00u, 0x5555c500u,
		0x8000e880u, 0xc0005cc0u, 0x60008e60u, 0x9000c590u,
		0xe8006868u, 0x5c009c9cu, 0x8e00eeeeu, 0xc5005555u
	);

	const uint SOBOL_DIRECTIONS_3[ 32 ] = uint[ 32 ](
		0x80000000u, 0xc0000000u, 0x20000000u, 0x50000000u,
		0xf8000000u, 0x74000000u, 0xa2000000u, 0x93000000u,
		0xd8800000u, 0x25400000u, 0x59e00000u, 0xe6d00000u,
		0x78080000u, 0xb40c0000u, 0x82020000u, 0xc3050000u,
		0x208f8000u, 0x51474000u, 0xfbea2000u, 0x75d93000u,
		0xa0858800u, 0x914e5400u, 0xdbe79e00u, 0x25db6d00u,
		0x58800080u, 0xe54000c0u, 0x79e00020u, 0xb6d00050u,
		0x800800f8u, 0xc00c0074u, 0x200200a2u, 0x50050093u
	);

	const uint SOBOL_DIRECTIONS_4[ 32 ] = uint[ 32 ](
		0x80000000u, 0x40000000u, 0x20000000u, 0xb0000000u,
		0xf8000000u, 0xdc000000u, 0x7a000000u, 0x9d000000u,
		0x5a800000u, 0x2fc00000u, 0xa1600000u, 0xf0b00000u,
		0xda880000u, 0x6fc40000u, 0x81620000u, 0x40bb0000u,
		0x22878000u, 0xb3c9c000u, 0xfb65a000u, 0xddb2d000u,
		0x78022800u, 0x9c0b3c00u, 0x5a0fb600u, 0x2d0ddb00u,
		0xa2878080u, 0xf3c9c040u, 0xdb65a020u, 0x6db2d0b0u,
		0x800228f8u, 0x400b3cdcu, 0x200fb67au, 0xb00ddb9du
	);

	uint getMaskedSobol( uint index, uint directions[ 32 ] ) {

		uint X = 0u;
		for ( int bit = 0; bit < 32; bit ++ ) {

			uint mask = ( index >> bit ) & 1u;
			X ^= mask * directions[ bit ];

		}
		return X;

	}

	vec4 generateSobolPoint( uint index ) {

		if ( index >= SOBOL_MAX_POINTS ) {

			return vec4( 0.0 );

		}

		// NOTE: this sobol "direction" is also available but we can't write out 5 components
		// uint x = index & 0x00ffffffu;
		uint x = sobolReverseBits( getMaskedSobol( index, SOBOL_DIRECTIONS_1 ) ) & 0x00ffffffu;
		uint y = sobolReverseBits( getMaskedSobol( index, SOBOL_DIRECTIONS_2 ) ) & 0x00ffffffu;
		uint z = sobolReverseBits( getMaskedSobol( index, SOBOL_DIRECTIONS_3 ) ) & 0x00ffffffu;
		uint w = sobolReverseBits( getMaskedSobol( index, SOBOL_DIRECTIONS_4 ) ) & 0x00ffffffu;

		return vec4( x, y, z, w ) * SOBOL_FACTOR;

	}

`;

	const sobol_functions = /* glsl */`

	// Seeds
	uniform sampler2D sobolTexture;
	uint sobolPixelIndex = 0u;
	uint sobolPathIndex = 0u;
	uint sobolBounceIndex = 0u;

	uint sobolGetSeed( uint bounce, uint effect ) {

		return sobolHash(
			sobolHashCombine(
				sobolHashCombine(
					sobolHash( bounce ),
					sobolPixelIndex
				),
				effect
			)
		);

	}

	vec4 sobolGetTexturePoint( uint index ) {

		if ( index >= SOBOL_MAX_POINTS ) {

			index = index % SOBOL_MAX_POINTS;

		}

		uvec2 dim = uvec2( textureSize( sobolTexture, 0 ).xy );
		uint y = index / dim.x;
		uint x = index - y * dim.x;
		vec2 uv = vec2( x, y ) / vec2( dim );
		return texture( sobolTexture, uv );

	}

	${ generateSobolSampleFunctions( 1 ) }
	${ generateSobolSampleFunctions( 2 ) }
	${ generateSobolSampleFunctions( 3 ) }
	${ generateSobolSampleFunctions( 4 ) }

`;

	class SobolNumbersMaterial extends MaterialBase {

		constructor() {

			super( {

				blending: three.NoBlending,

				uniforms: {

					resolution: { value: new three.Vector2() },

				},

				vertexShader: /* glsl */`

				varying vec2 vUv;
				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}
			`,

				fragmentShader: /* glsl */`

				${ sobol_common }
				${ sobol_point_generation }

				varying vec2 vUv;
				uniform vec2 resolution;
				void main() {

					uint index = uint( gl_FragCoord.y ) * uint( resolution.x ) + uint( gl_FragCoord.x );
					gl_FragColor = generateSobolPoint( index );

				}
			`,

			} );

		}

	}

	class SobolNumberMapGenerator {

		generate( renderer, dimensions = 256 ) {

			const target = new three.WebGLRenderTarget( dimensions, dimensions, {

				type: three.FloatType,
				format: three.RGBAFormat,
				minFilter: three.NearestFilter,
				magFilter: three.NearestFilter,
				generateMipmaps: false,

			} );

			const ogTarget = renderer.getRenderTarget();
			renderer.setRenderTarget( target );

			const quad = new Pass_js.FullScreenQuad( new SobolNumbersMaterial() );
			quad.material.resolution.set( dimensions, dimensions );
			quad.render( renderer );

			renderer.setRenderTarget( ogTarget );
			quad.dispose();

			return target;

		}

	}

	class PhysicalCamera extends three.PerspectiveCamera {

		set bokehSize( size ) {

			this.fStop = this.getFocalLength() / size;

		}

		get bokehSize() {

			return this.getFocalLength() / this.fStop;

		}

		constructor( ...args ) {

			super( ...args );
			this.fStop = 1.4;
			this.apertureBlades = 0;
			this.apertureRotation = 0;
			this.focusDistance = 25;
			this.anamorphicRatio = 1;

		}

		copy( source, recursive ) {

			super.copy( source, recursive );

			this.fStop = source.fStop;
			this.apertureBlades = source.apertureBlades;
			this.apertureRotation = source.apertureRotation;
			this.focusDistance = source.focusDistance;
			this.anamorphicRatio = source.anamorphicRatio;

			return this;

		}

	}

	class PhysicalCameraUniform {

		constructor() {

			this.bokehSize = 0;
			this.apertureBlades = 0;
			this.apertureRotation = 0;
			this.focusDistance = 10;
			this.anamorphicRatio = 1;

		}

		updateFrom( camera ) {

			if ( camera instanceof PhysicalCamera ) {

				this.bokehSize = camera.bokehSize;
				this.apertureBlades = camera.apertureBlades;
				this.apertureRotation = camera.apertureRotation;
				this.focusDistance = camera.focusDistance;
				this.anamorphicRatio = camera.anamorphicRatio;

			} else {

				this.bokehSize = 0;
				this.apertureRotation = 0;
				this.apertureBlades = 0;
				this.focusDistance = 10;
				this.anamorphicRatio = 1;

			}

		}

	}

	function toHalfFloatArray( f32Array ) {

		const f16Array = new Uint16Array( f32Array.length );
		for ( let i = 0, n = f32Array.length; i < n; ++ i ) {

			f16Array[ i ] = three.DataUtils.toHalfFloat( f32Array[ i ] );

		}

		return f16Array;

	}

	function binarySearchFindClosestIndexOf( array, targetValue, offset = 0, count = array.length ) {

		let lower = offset;
		let upper = offset + count - 1;

		while ( lower < upper ) {

			// calculate the midpoint for this iteration using a bitwise shift right operator to save 1 floating point multiplication
			// and 1 truncation from the double tilde operator to improve performance
			// this results in much better performance over using standard "~ ~ ( (lower + upper) ) / 2" to calculate the midpoint
			const mid = ( lower + upper ) >> 1;

			// check if the middle array value is above or below the target and shift
			// which half of the array we're looking at
			if ( array[ mid ] < targetValue ) {

				lower = mid + 1;

			} else {

				upper = mid;

			}

		}

		return lower - offset;

	}

	function colorToLuminance( r, g, b ) {

		// https://en.wikipedia.org/wiki/Relative_luminance
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;

	}

	// ensures the data is all floating point values and flipY is false
	function preprocessEnvMap( envMap, targetType = three.HalfFloatType ) {

		const map = envMap.clone();
		map.source = new three.Source( { ...map.image } );
		const { width, height, data } = map.image;

		// TODO: is there a simple way to avoid cloning and adjusting the env map data here?
		// convert the data from half float uint 16 arrays to float arrays for cdf computation
		let newData = data;
		if ( map.type !== targetType ) {

			if ( targetType === three.HalfFloatType ) {

				newData = new Uint16Array( data.length );

			} else {

				newData = new Float32Array( data.length );

			}

			let maxIntValue;
			if ( data instanceof Int8Array || data instanceof Int16Array || data instanceof Int32Array ) {

				maxIntValue = 2 ** ( 8 * data.BYTES_PER_ELEMENT - 1 ) - 1;

			} else {

				maxIntValue = 2 ** ( 8 * data.BYTES_PER_ELEMENT ) - 1;

			}

			for ( let i = 0, l = data.length; i < l; i ++ ) {

				let v = data[ i ];
				if ( map.type === three.HalfFloatType ) {

					v = three.DataUtils.fromHalfFloat( data[ i ] );

				}

				if ( map.type !== three.FloatType && map.type !== three.HalfFloatType ) {

					v /= maxIntValue;

				}

				if ( targetType === three.HalfFloatType ) {

					newData[ i ] = three.DataUtils.toHalfFloat( v );

				}

			}

			map.image.data = newData;
			map.type = targetType;

		}

		// remove any y flipping for cdf computation
		if ( map.flipY ) {

			const ogData = newData;
			newData = newData.slice();
			for ( let y = 0; y < height; y ++ ) {

				for ( let x = 0; x < width; x ++ ) {

					const newY = height - y - 1;
					const ogIndex = 4 * ( y * width + x );
					const newIndex = 4 * ( newY * width + x );

					newData[ newIndex + 0 ] = ogData[ ogIndex + 0 ];
					newData[ newIndex + 1 ] = ogData[ ogIndex + 1 ];
					newData[ newIndex + 2 ] = ogData[ ogIndex + 2 ];
					newData[ newIndex + 3 ] = ogData[ ogIndex + 3 ];

				}

			}

			map.flipY = false;
			map.image.data = newData;

		}

		return map;

	}

	class EquirectHdrInfoUniform {

		constructor() {

			// Default to a white texture and associated weights so we don't
			// just render black initially.
			const blackTex = new three.DataTexture( toHalfFloatArray( new Float32Array( [ 0, 0, 0, 0 ] ) ), 1, 1 );
			blackTex.type = three.HalfFloatType;
			blackTex.format = three.RGBAFormat;
			blackTex.minFilter = three.LinearFilter;
			blackTex.magFilter = three.LinearFilter;
			blackTex.wrapS = three.RepeatWrapping;
			blackTex.wrapT = three.RepeatWrapping;
			blackTex.generateMipmaps = false;
			blackTex.needsUpdate = true;

			// Stores a map of [0, 1] value -> cumulative importance row & pdf
			// used to sampling a random value to a relevant row to sample from
			const marginalWeights = new three.DataTexture( toHalfFloatArray( new Float32Array( [ 0, 1 ] ) ), 1, 2 );
			marginalWeights.type = three.HalfFloatType;
			marginalWeights.format = three.RedFormat;
			marginalWeights.minFilter = three.LinearFilter;
			marginalWeights.magFilter = three.LinearFilter;
			marginalWeights.generateMipmaps = false;
			marginalWeights.needsUpdate = true;

			// Stores a map of [0, 1] value -> cumulative importance column & pdf
			// used to sampling a random value to a relevant pixel to sample from
			const conditionalWeights = new three.DataTexture( toHalfFloatArray( new Float32Array( [ 0, 0, 1, 1 ] ) ), 2, 2 );
			conditionalWeights.type = three.HalfFloatType;
			conditionalWeights.format = three.RedFormat;
			conditionalWeights.minFilter = three.LinearFilter;
			conditionalWeights.magFilter = three.LinearFilter;
			conditionalWeights.generateMipmaps = false;
			conditionalWeights.needsUpdate = true;

			this.map = blackTex;
			this.marginalWeights = marginalWeights;
			this.conditionalWeights = conditionalWeights;
			this.totalSum = 0;

			// TODO: Add support for float or half float types here. We need to pass this into
			// the preprocess function and ensure our CDF and MDF textures are appropriately sized
			// Ideally we wouldn't upscale a bit depth if we didn't need to.
			// this.type = HalfFloatType;

		}

		dispose() {

			this.marginalWeights.dispose();
			this.conditionalWeights.dispose();
			this.map.dispose();

		}

		updateFrom( hdr ) {

			// https://github.com/knightcrawler25/GLSL-PathTracer/blob/3c6fd9b6b3da47cd50c527eeb45845eef06c55c3/src/loaders/hdrloader.cpp
			// https://pbr-book.org/3ed-2018/Light_Transport_I_Surface_Reflection/Sampling_Light_Sources#InfiniteAreaLights
			const map = preprocessEnvMap( hdr );
			map.wrapS = three.RepeatWrapping;
			map.wrapT = three.ClampToEdgeWrapping;

			const { width, height, data } = map.image;

			// "conditional" = "pixel relative to row pixels sum"
			// "marginal" = "row relative to row sum"

			// track the importance of any given pixel in the image by tracking its weight relative to other pixels in the image
			const pdfConditional = new Float32Array( width * height );
			const cdfConditional = new Float32Array( width * height );

			const pdfMarginal = new Float32Array( height );
			const cdfMarginal = new Float32Array( height );

			let totalSumValue = 0.0;
			let cumulativeWeightMarginal = 0.0;
			for ( let y = 0; y < height; y ++ ) {

				let cumulativeRowWeight = 0.0;
				for ( let x = 0; x < width; x ++ ) {

					const i = y * width + x;
					const r = three.DataUtils.fromHalfFloat( data[ 4 * i + 0 ] );
					const g = three.DataUtils.fromHalfFloat( data[ 4 * i + 1 ] );
					const b = three.DataUtils.fromHalfFloat( data[ 4 * i + 2 ] );

					// the probability of the pixel being selected in this row is the
					// scale of the luminance relative to the rest of the pixels.
					// TODO: this should also account for the solid angle of the pixel when sampling
					const weight = colorToLuminance( r, g, b );
					cumulativeRowWeight += weight;
					totalSumValue += weight;

					pdfConditional[ i ] = weight;
					cdfConditional[ i ] = cumulativeRowWeight;

				}

				// can happen if the row is all black
				if ( cumulativeRowWeight !== 0 ) {

					// scale the pdf and cdf to [0.0, 1.0]
					for ( let i = y * width, l = y * width + width; i < l; i ++ ) {

						pdfConditional[ i ] /= cumulativeRowWeight;
						cdfConditional[ i ] /= cumulativeRowWeight;

					}

				}

				cumulativeWeightMarginal += cumulativeRowWeight;

				// compute the marginal pdf and cdf along the height of the map.
				pdfMarginal[ y ] = cumulativeRowWeight;
				cdfMarginal[ y ] = cumulativeWeightMarginal;

			}

			// can happen if the texture is all black
			if ( cumulativeWeightMarginal !== 0 ) {

				// scale the marginal pdf and cdf to [0.0, 1.0]
				for ( let i = 0, l = pdfMarginal.length; i < l; i ++ ) {

					pdfMarginal[ i ] /= cumulativeWeightMarginal;
					cdfMarginal[ i ] /= cumulativeWeightMarginal;

				}

			}

			// compute a sorted index of distributions and the probabilities along them for both
			// the marginal and conditional data. These will be used to sample with a random number
			// to retrieve a uv value to sample in the environment map.
			// These values continually increase so it's okay to interpolate between them.
			const marginalDataArray = new Uint16Array( height );
			const conditionalDataArray = new Uint16Array( width * height );

			// we add a half texel offset so we're sampling the center of the pixel
			for ( let i = 0; i < height; i ++ ) {

				const dist = ( i + 1 ) / height;
				const row = binarySearchFindClosestIndexOf( cdfMarginal, dist );

				marginalDataArray[ i ] = three.DataUtils.toHalfFloat( ( row + 0.5 ) / height );

			}

			for ( let y = 0; y < height; y ++ ) {

				for ( let x = 0; x < width; x ++ ) {

					const i = y * width + x;
					const dist = ( x + 1 ) / width;
					const col = binarySearchFindClosestIndexOf( cdfConditional, dist, y * width, width );

					conditionalDataArray[ i ] = three.DataUtils.toHalfFloat( ( col + 0.5 ) / width );

				}

			}

			this.dispose();

			const { marginalWeights, conditionalWeights } = this;
			marginalWeights.image = { width: height, height: 1, data: marginalDataArray };
			marginalWeights.needsUpdate = true;

			conditionalWeights.image = { width, height, data: conditionalDataArray };
			conditionalWeights.needsUpdate = true;

			this.totalSum = totalSumValue;
			this.map = map;

		}

	}

	const LIGHT_PIXELS = 6;
	const RECT_AREA_LIGHT = 0;
	const CIRC_AREA_LIGHT = 1;
	const SPOT_LIGHT = 2;
	const DIR_LIGHT = 3;
	const POINT_LIGHT = 4;

	const u = new three.Vector3();
	const v = new three.Vector3();
	const m = new three.Matrix4();
	const worldQuaternion = new three.Quaternion();
	const eye = new three.Vector3();
	const target = new three.Vector3();
	const up = new three.Vector3( 0, 1, 0 );
	class LightsInfoUniformStruct {

		constructor() {

			const tex = new three.DataTexture( new Float32Array( 4 ), 1, 1 );
			tex.format = three.RGBAFormat;
			tex.type = three.FloatType;
			tex.wrapS = three.ClampToEdgeWrapping;
			tex.wrapT = three.ClampToEdgeWrapping;
			tex.generateMipmaps = false;
			tex.minFilter = three.NearestFilter;
			tex.magFilter = three.NearestFilter;

			this.tex = tex;
			this.count = 0;

		}

		updateFrom( lights, iesTextures = [] ) {

			const tex = this.tex;
			const pixelCount = Math.max( lights.length * LIGHT_PIXELS, 1 );
			const dimension = Math.ceil( Math.sqrt( pixelCount ) );

			if ( tex.image.width !== dimension ) {

				tex.dispose();

				tex.image.data = new Float32Array( dimension * dimension * 4 );
				tex.image.width = dimension;
				tex.image.height = dimension;

			}

			const floatArray = tex.image.data;

			for ( let i = 0, l = lights.length; i < l; i ++ ) {

				const l = lights[ i ];

				const baseIndex = i * LIGHT_PIXELS * 4;
				let index = 0;

				// initialize to 0
				for ( let p = 0; p < LIGHT_PIXELS * 4; p ++ ) {

					floatArray[ baseIndex + p ] = 0;

				}

				// sample 1
			    // position
				l.getWorldPosition( v );
				floatArray[ baseIndex + ( index ++ ) ] = v.x;
				floatArray[ baseIndex + ( index ++ ) ] = v.y;
				floatArray[ baseIndex + ( index ++ ) ] = v.z;

				// type
				let type = RECT_AREA_LIGHT;
				if ( l.isRectAreaLight && l.isCircular ) {

					type = CIRC_AREA_LIGHT;

				} else if ( l.isSpotLight ) {

					type = SPOT_LIGHT;

				} else if ( l.isDirectionalLight ) {

					type = DIR_LIGHT;

				} else if ( l.isPointLight ) {

					type = POINT_LIGHT;

				}

				floatArray[ baseIndex + ( index ++ ) ] = type;

				// sample 2
				// color
				floatArray[ baseIndex + ( index ++ ) ] = l.color.r;
				floatArray[ baseIndex + ( index ++ ) ] = l.color.g;
				floatArray[ baseIndex + ( index ++ ) ] = l.color.b;

				// intensity
				floatArray[ baseIndex + ( index ++ ) ] = l.intensity;

				l.getWorldQuaternion( worldQuaternion );

				if ( l.isRectAreaLight ) {

					// sample 3
					// u vector
					u.set( l.width, 0, 0 ).applyQuaternion( worldQuaternion );

					floatArray[ baseIndex + ( index ++ ) ] = u.x;
					floatArray[ baseIndex + ( index ++ ) ] = u.y;
					floatArray[ baseIndex + ( index ++ ) ] = u.z;
					index ++;

					// sample 4
					// v vector
					v.set( 0, l.height, 0 ).applyQuaternion( worldQuaternion );

					floatArray[ baseIndex + ( index ++ ) ] = v.x;
					floatArray[ baseIndex + ( index ++ ) ] = v.y;
					floatArray[ baseIndex + ( index ++ ) ] = v.z;

					// area
					floatArray[ baseIndex + ( index ++ ) ] = u.cross( v ).length() * ( l.isCircular ? ( Math.PI / 4.0 ) : 1.0 );

				} else if ( l.isSpotLight ) {

					const radius = l.radius || 0;
					eye.setFromMatrixPosition( l.matrixWorld );
					target.setFromMatrixPosition( l.target.matrixWorld );
					m.lookAt( eye, target, up );
					worldQuaternion.setFromRotationMatrix( m );

					// sample 3
					// u vector
					u.set( 1, 0, 0 ).applyQuaternion( worldQuaternion );

					floatArray[ baseIndex + ( index ++ ) ] = u.x;
					floatArray[ baseIndex + ( index ++ ) ] = u.y;
					floatArray[ baseIndex + ( index ++ ) ] = u.z;
					index ++;

					// sample 4
					// v vector
					v.set( 0, 1, 0 ).applyQuaternion( worldQuaternion );

					floatArray[ baseIndex + ( index ++ ) ] = v.x;
					floatArray[ baseIndex + ( index ++ ) ] = v.y;
					floatArray[ baseIndex + ( index ++ ) ] = v.z;

					// area
					floatArray[ baseIndex + ( index ++ ) ] = Math.PI * radius * radius;

					// sample 5
					// radius
					floatArray[ baseIndex + ( index ++ ) ] = radius;

					// decay
					floatArray[ baseIndex + ( index ++ ) ] = l.decay;

					// distance
					floatArray[ baseIndex + ( index ++ ) ] = l.distance;

					// coneCos
					floatArray[ baseIndex + ( index ++ ) ] = Math.cos( l.angle );

					// sample 6
					// penumbraCos
					floatArray[ baseIndex + ( index ++ ) ] = Math.cos( l.angle * ( 1 - l.penumbra ) );

					// iesProfile
					floatArray[ baseIndex + ( index ++ ) ] = l.iesMap ? iesTextures.indexOf( l.iesMap ) : - 1;

				} else if ( l.isPointLight ) {

					const worldPosition = u.setFromMatrixPosition( l.matrixWorld );

					// sample 3
					// u vector
					floatArray[ baseIndex + ( index ++ ) ] = worldPosition.x;
					floatArray[ baseIndex + ( index ++ ) ] = worldPosition.y;
					floatArray[ baseIndex + ( index ++ ) ] = worldPosition.z;
					index ++;

					// sample 4
					index += 4;

					// sample 5
					index += 1;

					floatArray[ baseIndex + ( index ++ ) ] = l.decay;
					floatArray[ baseIndex + ( index ++ ) ] = l.distance;

				} else if ( l.isDirectionalLight ) {

					const worldPosition = u.setFromMatrixPosition( l.matrixWorld );
					const targetPosition = v.setFromMatrixPosition( l.target.matrixWorld );
					target.subVectors( worldPosition, targetPosition ).normalize();

					// sample 3
					// u vector
					floatArray[ baseIndex + ( index ++ ) ] = target.x;
					floatArray[ baseIndex + ( index ++ ) ] = target.y;
					floatArray[ baseIndex + ( index ++ ) ] = target.z;

				}

			}

			this.count = lights.length;

			const hash = bufferToHash( floatArray.buffer );
			if ( this.hash !== hash ) {

				this.hash = hash;
				tex.needsUpdate = true;
				return true;

			}

			return false;

		}

	}

	function copyArrayToArray( fromArray, fromStride, toArray, toStride, offset ) {

		if ( fromStride > toStride ) {

			throw new Error();

		}

		// scale non-float values to their normalized range
		const count = fromArray.length / fromStride;
		const bpe = fromArray.constructor.BYTES_PER_ELEMENT * 8;
		let maxValue = 1.0;
		switch ( fromArray.constructor ) {

		case Uint8Array:
		case Uint16Array:
		case Uint32Array:
			maxValue = 2 ** bpe - 1;
			break;

		case Int8Array:
		case Int16Array:
		case Int32Array:
			maxValue = 2 ** ( bpe - 1 ) - 1;
			break;

		}

		for ( let i = 0; i < count; i ++ ) {

			const i4 = 4 * i;
			const is = fromStride * i;
			for ( let j = 0; j < toStride; j ++ ) {

				toArray[ offset + i4 + j ] = fromStride >= j + 1 ? fromArray[ is + j ] / maxValue : 0;

			}

		}

	}

	class FloatAttributeTextureArray extends three.DataArrayTexture {

		constructor() {

			super();
			this._textures = [];
			this.type = three.FloatType;
			this.format = three.RGBAFormat;
			this.internalFormat = 'RGBA32F';

		}

		updateAttribute( index, attr ) {

			// update the texture
			const tex = this._textures[ index ];
			tex.updateFrom( attr );

			// ensure compatibility
			const baseImage = tex.image;
			const image = this.image;
			if ( baseImage.width !== image.width || baseImage.height !== image.height ) {

				throw new Error( 'FloatAttributeTextureArray: Attribute must be the same dimensions when updating single layer.' );

			}

			// update the image
			const { width, height, data } = image;
			const length = width * height * 4;
			const offset = length * index;
			let itemSize = attr.itemSize;
			if ( itemSize === 3 ) {

				itemSize = 4;

			}

			// copy the data
			copyArrayToArray( tex.image.data, itemSize, data, 4, offset );

			this.dispose();
			this.needsUpdate = true;

		}

		setAttributes( attrs ) {

			// ensure the attribute count
			const itemCount = attrs[ 0 ].count;
			const attrsLength = attrs.length;
			for ( let i = 0, l = attrsLength; i < l; i ++ ) {

				if ( attrs[ i ].count !== itemCount ) {

					throw new Error( 'FloatAttributeTextureArray: All attributes must have the same item count.' );

				}

			}

			// initialize all textures
			const textures = this._textures;
			while ( textures.length < attrsLength ) {

				const tex = new threeMeshBvh.FloatVertexAttributeTexture();
				textures.push( tex );

			}

			while ( textures.length > attrsLength ) {

				textures.pop();

			}

			// update all textures
			for ( let i = 0, l = attrsLength; i < l; i ++ ) {

				textures[ i ].updateFrom( attrs[ i ] );

			}

			// determine if we need to create a new array
			const baseTexture = textures[ 0 ];
			const baseImage = baseTexture.image;
			const image = this.image;

			if ( baseImage.width !== image.width || baseImage.height !== image.height || baseImage.depth !== attrsLength ) {

				image.width = baseImage.width;
				image.height = baseImage.height;
				image.depth = attrsLength;
				image.data = new Float32Array( image.width * image.height * image.depth * 4 );

			}

			// copy the other texture data into the data array texture
			const { data, width, height } = image;
			for ( let i = 0, l = attrsLength; i < l; i ++ ) {

				const tex = textures[ i ];
				const length = width * height * 4;
				const offset = length * i;

				let itemSize = attrs[ i ].itemSize;
				if ( itemSize === 3 ) {

					itemSize = 4;

				}

				copyArrayToArray( tex.image.data, itemSize, data, 4, offset );

			}

			// reset the texture
			this.dispose();
			this.needsUpdate = true;

		}


	}

	class AttributesTextureArray extends FloatAttributeTextureArray {

		updateNormalAttribute( attr ) {

			this.updateAttribute( 0, attr );

		}

		updateTangentAttribute( attr ) {

			this.updateAttribute( 1, attr );

		}

		updateUvAttribute( attr ) {

			this.updateAttribute( 2, attr );

		}

		updateColorAttribute( attr ) {

			this.updateAttribute( 3, attr );

		}

		updateFrom( normal, tangent, uv, color ) {

			this.setAttributes( [ normal, tangent, uv, color ] );

		}

	}

	function uuidSort( a, b ) {

		if ( a.uuid < b.uuid ) return 1;
		if ( a.uuid > b.uuid ) return - 1;
		return 0;

	}

	// we must hash the texture to determine uniqueness using the encoding, as well, because the
	// when rendering each texture to the texture array they must have a consistent color space.
	function getTextureHash$1( t ) {

		return `${ t.source.uuid }:${ t.colorSpace }`;

	}

	// reduce the set of textures to just those with a unique source while retaining
	// the order of the textures.
	function reduceTexturesToUniqueSources( textures ) {

		const sourceSet = new Set();
		const result = [];
		for ( let i = 0, l = textures.length; i < l; i ++ ) {

			const tex = textures[ i ];
			const hash = getTextureHash$1( tex );
			if ( ! sourceSet.has( hash ) ) {

				sourceSet.add( hash );
				result.push( tex );

			}

		}

		return result;

	}

	function getIesTextures( lights ) {

		const textures = lights.map( l => l.iesMap || null ).filter( t => t );
		const textureSet = new Set( textures );
		return Array.from( textureSet ).sort( uuidSort );

	}

	function getTextures( materials ) {

		const textureSet = new Set();
		for ( let i = 0, l = materials.length; i < l; i ++ ) {

			const material = materials[ i ];
			for ( const key in material ) {

				const value = material[ key ];
				if ( value && value.isTexture ) {

					textureSet.add( value );

				}

			}

		}

		const textureArray = Array.from( textureSet );
		return reduceTexturesToUniqueSources( textureArray ).sort( uuidSort );

	}

	function getLights( scene ) {

		const lights = [];
		scene.traverse( c => {

			if ( c.visible ) {

				if (
					c.isRectAreaLight ||
					c.isSpotLight ||
					c.isPointLight ||
					c.isDirectionalLight
				) {

					lights.push( c );

				}

			}

		} );

		return lights.sort( uuidSort );

	}

	const MATERIAL_PIXELS = 45;
	const MATERIAL_STRIDE = MATERIAL_PIXELS * 4;

	class MaterialFeatures {

		constructor() {

			this._features = {};

		}

		isUsed( feature ) {

			return feature in this._features;

		}

		setUsed( feature, used = true ) {

			if ( used === false ) {

				delete this._features[ feature ];

			} else {

				this._features[ feature ] = true;

			}

		}

		reset() {

			this._features = {};

		}

	}

	class MaterialsTexture extends three.DataTexture {

		constructor() {

			super( new Float32Array( 4 ), 1, 1 );

			this.format = three.RGBAFormat;
			this.type = three.FloatType;
			this.wrapS = three.ClampToEdgeWrapping;
			this.wrapT = three.ClampToEdgeWrapping;
			this.minFilter = three.NearestFilter;
			this.magFilter = three.NearestFilter;
			this.generateMipmaps = false;
			this.features = new MaterialFeatures();

		}

		updateFrom( materials, textures ) {

			function getTexture( material, key, def = - 1 ) {

				if ( key in material && material[ key ] ) {

					const hash = getTextureHash$1( material[ key ] );
					return textureLookUp[ hash ];

				} else {

					return def;

				}

			}

			function getField( material, key, def ) {

				return key in material ? material[ key ] : def;

			}

			function writeTextureMatrixToArray( material, textureKey, array, offset ) {

				const texture = material[ textureKey ] && material[ textureKey ].isTexture ? material[ textureKey ] : null;

				// check if texture exists
				if ( texture ) {

					if ( texture.matrixAutoUpdate ) {

						texture.updateMatrix();

					}

					const elements = texture.matrix.elements;

					let i = 0;

					// first row
					array[ offset + i ++ ] = elements[ 0 ];
					array[ offset + i ++ ] = elements[ 3 ];
					array[ offset + i ++ ] = elements[ 6 ];
					i ++;

					// second row
					array[ offset + i ++ ] = elements[ 1 ];
					array[ offset + i ++ ] = elements[ 4 ];
					array[ offset + i ++ ] = elements[ 7 ];
					i ++;

				}

				return 8;

			}

			let index = 0;
			const pixelCount = materials.length * MATERIAL_PIXELS;
			const dimension = Math.ceil( Math.sqrt( pixelCount ) ) || 1;
			const { image, features } = this;

			// index the list of textures based on shareable source
			const textureLookUp = {};
			for ( let i = 0, l = textures.length; i < l; i ++ ) {

				textureLookUp[ getTextureHash$1( textures[ i ] ) ] = i;

			}

			if ( image.width !== dimension ) {

				this.dispose();

				image.data = new Float32Array( dimension * dimension * 4 );
				image.width = dimension;
				image.height = dimension;

			}

			const floatArray = image.data;

			// on some devices (Google Pixel 6) the "floatBitsToInt" function does not work correctly so we
			// can't encode texture ids that way.
			// const intArray = new Int32Array( floatArray.buffer );

			features.reset();
			for ( let i = 0, l = materials.length; i < l; i ++ ) {

				const m = materials[ i ];

				if ( m.isFogVolumeMaterial ) {

					features.setUsed( 'FOG' );

					for ( let j = 0; j < MATERIAL_STRIDE; j ++ ) {

						floatArray[ index + j ] = 0;

					}

					// sample 0 .rgb
					floatArray[ index + 0 * 4 + 0 ] = m.color.r;
					floatArray[ index + 0 * 4 + 1 ] = m.color.g;
					floatArray[ index + 0 * 4 + 2 ] = m.color.b;

					// sample 2 .a
					floatArray[ index + 2 * 4 + 3 ] = getField( m, 'emissiveIntensity', 0.0 );

					// sample 3 .rgb
					floatArray[ index + 3 * 4 + 0 ] = m.emissive.r;
					floatArray[ index + 3 * 4 + 1 ] = m.emissive.g;
					floatArray[ index + 3 * 4 + 2 ] = m.emissive.b;

					// sample 13 .g
					// reusing opacity field
					floatArray[ index + 13 * 4 + 1 ] = m.density;

					// side
					floatArray[ index + 13 * 4 + 3 ] = 0.0;

					// sample 14 .b
					floatArray[ index + 14 * 4 + 2 ] = 1 << 2;

					index += MATERIAL_STRIDE;
					continue;

				}

				// sample 0
				// color
				floatArray[ index ++ ] = m.color.r;
				floatArray[ index ++ ] = m.color.g;
				floatArray[ index ++ ] = m.color.b;
				floatArray[ index ++ ] = getTexture( m, 'map' );

				// sample 1
				// metalness & roughness
				floatArray[ index ++ ] = getField( m, 'metalness', 0.0 );
				floatArray[ index ++ ] = getTexture( m, 'metalnessMap' );
				floatArray[ index ++ ] = getField( m, 'roughness', 0.0 );
				floatArray[ index ++ ] = getTexture( m, 'roughnessMap' );

				// sample 2
				// transmission & emissiveIntensity
				// three.js assumes a default f0 of 0.04 if no ior is provided which equates to an ior of 1.5
				floatArray[ index ++ ] = getField( m, 'ior', 1.5 );
				floatArray[ index ++ ] = getField( m, 'transmission', 0.0 );
				floatArray[ index ++ ] = getTexture( m, 'transmissionMap' );
				floatArray[ index ++ ] = getField( m, 'emissiveIntensity', 0.0 );

				// sample 3
				// emission
				if ( 'emissive' in m ) {

					floatArray[ index ++ ] = m.emissive.r;
					floatArray[ index ++ ] = m.emissive.g;
					floatArray[ index ++ ] = m.emissive.b;

				} else {

					floatArray[ index ++ ] = 0.0;
					floatArray[ index ++ ] = 0.0;
					floatArray[ index ++ ] = 0.0;

				}

				floatArray[ index ++ ] = getTexture( m, 'emissiveMap' );

				// sample 4
				// normals
				floatArray[ index ++ ] = getTexture( m, 'normalMap' );
				if ( 'normalScale' in m ) {

					floatArray[ index ++ ] = m.normalScale.x;
					floatArray[ index ++ ] = m.normalScale.y;

	 			} else {

	 				floatArray[ index ++ ] = 1;
	 				floatArray[ index ++ ] = 1;

	 			}

				// clearcoat
				floatArray[ index ++ ] = getField( m, 'clearcoat', 0.0 );
				floatArray[ index ++ ] = getTexture( m, 'clearcoatMap' ); // sample 5

				floatArray[ index ++ ] = getField( m, 'clearcoatRoughness', 0.0 );
				floatArray[ index ++ ] = getTexture( m, 'clearcoatRoughnessMap' );

				floatArray[ index ++ ] = getTexture( m, 'clearcoatNormalMap' );

				// sample 6
				if ( 'clearcoatNormalScale' in m ) {

					floatArray[ index ++ ] = m.clearcoatNormalScale.x;
					floatArray[ index ++ ] = m.clearcoatNormalScale.y;

				} else {

					floatArray[ index ++ ] = 1;
					floatArray[ index ++ ] = 1;

				}

				index ++;
				floatArray[ index ++ ] = getField( m, 'sheen', 0.0 );

				// sample 7
				// sheen
				if ( 'sheenColor' in m ) {

					floatArray[ index ++ ] = m.sheenColor.r;
					floatArray[ index ++ ] = m.sheenColor.g;
					floatArray[ index ++ ] = m.sheenColor.b;

				} else {

					floatArray[ index ++ ] = 0.0;
					floatArray[ index ++ ] = 0.0;
					floatArray[ index ++ ] = 0.0;

				}

				floatArray[ index ++ ] = getTexture( m, 'sheenColorMap' );

				// sample 8
				floatArray[ index ++ ] = getField( m, 'sheenRoughness', 0.0 );
				floatArray[ index ++ ] = getTexture( m, 'sheenRoughnessMap' );

				// iridescence
				floatArray[ index ++ ] = getTexture( m, 'iridescenceMap' );
				floatArray[ index ++ ] = getTexture( m, 'iridescenceThicknessMap' );

				// sample 9
				floatArray[ index ++ ] = getField( m, 'iridescence', 0.0 );
				floatArray[ index ++ ] = getField( m, 'iridescenceIOR', 1.3 );

				const iridescenceThicknessRange = getField( m, 'iridescenceThicknessRange', [ 100, 400 ] );
				floatArray[ index ++ ] = iridescenceThicknessRange[ 0 ];
				floatArray[ index ++ ] = iridescenceThicknessRange[ 1 ];

				// sample 10
				// specular color
				if ( 'specularColor' in m ) {

					floatArray[ index ++ ] = m.specularColor.r;
					floatArray[ index ++ ] = m.specularColor.g;
					floatArray[ index ++ ] = m.specularColor.b;

				} else {

					floatArray[ index ++ ] = 1.0;
					floatArray[ index ++ ] = 1.0;
					floatArray[ index ++ ] = 1.0;

				}

				floatArray[ index ++ ] = getTexture( m, 'specularColorMap' );

				// sample 11
				// specular intensity
				floatArray[ index ++ ] = getField( m, 'specularIntensity', 1.0 );
				floatArray[ index ++ ] = getTexture( m, 'specularIntensityMap' );

				// isThinFilm
				const isThinFilm = getField( m, 'thickness', 0.0 ) === 0.0 && getField( m, 'attenuationDistance', Infinity ) === Infinity;
				floatArray[ index ++ ] = Number( isThinFilm );
				index ++;

				// sample 12
				if ( 'attenuationColor' in m ) {

					floatArray[ index ++ ] = m.attenuationColor.r;
					floatArray[ index ++ ] = m.attenuationColor.g;
					floatArray[ index ++ ] = m.attenuationColor.b;

				} else {

					floatArray[ index ++ ] = 1.0;
					floatArray[ index ++ ] = 1.0;
					floatArray[ index ++ ] = 1.0;

				}

				floatArray[ index ++ ] = getField( m, 'attenuationDistance', Infinity );

				// sample 13
				// alphaMap
				floatArray[ index ++ ] = getTexture( m, 'alphaMap' );

				// side & matte
				floatArray[ index ++ ] = m.opacity;
				floatArray[ index ++ ] = m.alphaTest;
				if ( ! isThinFilm && m.transmission > 0.0 ) {

					floatArray[ index ++ ] = 0;

				} else {

					switch ( m.side ) {

					case three.FrontSide:
						floatArray[ index ++ ] = 1;
						break;
					case three.BackSide:
						floatArray[ index ++ ] = - 1;
						break;
					case three.DoubleSide:
						floatArray[ index ++ ] = 0;
						break;

					}

				}

				// sample 14
				floatArray[ index ++ ] = Number( getField( m, 'matte', false ) ); // matte
				floatArray[ index ++ ] = Number( getField( m, 'castShadow', true ) ); // shadow
				floatArray[ index ++ ] = Number( m.vertexColors ) | ( Number( m.flatShading ) << 1 ); // vertexColors & flatShading
				floatArray[ index ++ ] = Number( m.transparent ); // transparent

				// map transform 15
				index += writeTextureMatrixToArray( m, 'map', floatArray, index );

				// metalnessMap transform 17
				index += writeTextureMatrixToArray( m, 'metalnessMap', floatArray, index );

				// roughnessMap transform 19
				index += writeTextureMatrixToArray( m, 'roughnessMap', floatArray, index );

				// transmissionMap transform 21
				index += writeTextureMatrixToArray( m, 'transmissionMap', floatArray, index );

				// emissiveMap transform 22
				index += writeTextureMatrixToArray( m, 'emissiveMap', floatArray, index );

				// normalMap transform 25
				index += writeTextureMatrixToArray( m, 'normalMap', floatArray, index );

				// clearcoatMap transform 27
				index += writeTextureMatrixToArray( m, 'clearcoatMap', floatArray, index );

				// clearcoatNormalMap transform 29
				index += writeTextureMatrixToArray( m, 'clearcoatNormalMap', floatArray, index );

				// clearcoatRoughnessMap transform 31
				index += writeTextureMatrixToArray( m, 'clearcoatRoughnessMap', floatArray, index );

				// sheenColorMap transform 33
				index += writeTextureMatrixToArray( m, 'sheenColorMap', floatArray, index );

				// sheenRoughnessMap transform 35
				index += writeTextureMatrixToArray( m, 'sheenRoughnessMap', floatArray, index );

				// iridescenceMap transform 37
				index += writeTextureMatrixToArray( m, 'iridescenceMap', floatArray, index );

				// iridescenceThicknessMap transform 39
				index += writeTextureMatrixToArray( m, 'iridescenceThicknessMap', floatArray, index );

				// specularColorMap transform 41
				index += writeTextureMatrixToArray( m, 'specularColorMap', floatArray, index );

				// specularIntensityMap transform 43
				index += writeTextureMatrixToArray( m, 'specularIntensityMap', floatArray, index );

			}

			// check if the contents have changed
			const hash = bufferToHash( floatArray.buffer );
			if ( this.hash !== hash ) {

				this.hash = hash;
				this.needsUpdate = true;
				return true;

			}

			return false;

		}

	}

	const prevColor = new three.Color();
	function getTextureHash( texture ) {

		return texture ? `${ texture.uuid }:${ texture.version }` : null;

	}

	function assignOptions( target, options ) {

		for ( const key in options ) {

			if ( key in target ) {

				target[ key ] = options[ key ];

			}

		}

	}

	class RenderTarget2DArray extends three.WebGLArrayRenderTarget {

		constructor( width, height, options ) {

			const textureOptions = {
				format: three.RGBAFormat,
				type: three.UnsignedByteType,
				minFilter: three.LinearFilter,
				magFilter: three.LinearFilter,
				wrapS: three.RepeatWrapping,
				wrapT: three.RepeatWrapping,
				generateMipmaps: false,
				...options,
			};

			super( width, height, 1, textureOptions );

			// manually assign the options because passing options into the
			// constructor does not work
			assignOptions( this.texture, textureOptions );

			this.texture.setTextures = ( ...args ) => {

				this.setTextures( ...args );

			};

			this.hashes = [ null ];

			const fsQuad = new Pass_js.FullScreenQuad( new CopyMaterial() );
			this.fsQuad = fsQuad;

		}

		setTextures( renderer, textures, width = this.width, height = this.height ) {

			// save previous renderer state
			const prevRenderTarget = renderer.getRenderTarget();
			const prevToneMapping = renderer.toneMapping;
			const prevAlpha = renderer.getClearAlpha();
			renderer.getClearColor( prevColor );

			// resize the render target and ensure we don't have an empty texture
			// render target depth must be >= 1 to avoid unbound texture error on android devices
			const depth = textures.length || 1;
			if ( width !== this.width || height !== this.height || this.depth !== depth ) {

				this.setSize( width, height, depth );
				this.hashes = new Array( depth ).fill( null );

			}

			renderer.setClearColor( 0, 0 );
			renderer.toneMapping = three.NoToneMapping;

			// render each texture into each layer of the target
			const fsQuad = this.fsQuad;
			const hashes = this.hashes;
			let updated = false;
			for ( let i = 0, l = depth; i < l; i ++ ) {

				const texture = textures[ i ];
				const hash = getTextureHash( texture );
				if ( texture && ( hashes[ i ] !== hash || texture.isWebGLRenderTarget ) ) {

					// revert to default texture transform before rendering
					texture.matrixAutoUpdate = false;
					texture.matrix.identity();

					fsQuad.material.map = texture;

					renderer.setRenderTarget( this, i );
					fsQuad.render( renderer );

					// restore custom texture transform
					texture.updateMatrix();
					texture.matrixAutoUpdate = true;

					// ensure textures are not updated unnecessarily
					hashes[ i ] = hash;
					updated = true;

				}

			}

			// reset the renderer
			fsQuad.material.map = null;
			renderer.setClearColor( prevColor, prevAlpha );
			renderer.setRenderTarget( prevRenderTarget );
			renderer.toneMapping = prevToneMapping;

			return updated;

		}

		dispose() {

			super.dispose();
			this.fsQuad.dispose();

		}

	}

	class CopyMaterial extends three.ShaderMaterial {

		get map() {

			return this.uniforms.map.value;

		}
		set map( v ) {

			this.uniforms.map.value = v;

		}

		constructor() {

			super( {
				uniforms: {

					map: { value: null },

				},

				vertexShader: /* glsl */`
				varying vec2 vUv;
				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}
			`,

				fragmentShader: /* glsl */`
				uniform sampler2D map;
				varying vec2 vUv;
				void main() {

					gl_FragColor = texture2D( map, vUv );

				}
			`
			} );

		}

	}

	// Stratified Sampling based on implementation from hoverinc pathtracer
	// - https://github.com/hoverinc/ray-tracing-renderer
	// - http://www.pbr-book.org/3ed-2018/Sampling_and_Reconstruction/Stratified_Sampling.html

	function shuffle( arr, random = Math.random() ) {

		for ( let i = arr.length - 1; i > 0; i -- ) {

		  const j = Math.floor( random() * ( i + 1 ) );
		  const x = arr[ i ];
		  arr[ i ] = arr[ j ];
		  arr[ j ] = x;

		}

		return arr;

	}

	// strataCount : The number of bins per dimension
	// dimensions  : The number of dimensions to generate stratified values for
	class StratifiedSampler {

		constructor( strataCount, dimensions, random = Math.random ) {

			const l = strataCount ** dimensions;
			const strata = new Uint16Array( l );
			let index = l;

			// each integer represents a statum bin
			for ( let i = 0; i < l; i ++ ) {

				strata[ i ] = i;

			}

			this.samples = new Float32Array( dimensions );

			this.strataCount = strataCount;

			this.reset = function () {

				for ( let i = 0; i < l; i ++ ) {

					strata[ i ] = i;

				}

				index = 0;

			};

			this.reshuffle = function () {

				index = 0;

			};

			this.next = function () {

				const { samples } = this;

				if ( index >= strata.length ) {

					shuffle( strata, random );
					this.reshuffle();

				}

				let stratum = strata[ index ++ ];

				for ( let i = 0; i < dimensions; i ++ ) {

					samples[ i ] = ( stratum % strataCount + random() ) / strataCount;
					stratum = Math.floor( stratum / strataCount );

				}

				return samples;

			};

		}

	}

	// Stratified Sampling based on implementation from hoverinc pathtracer

	// Stratified set of data with each tuple stratified separately and combined
	class StratifiedSamplerCombined {

		constructor( strataCount, listOfDimensions, random = Math.random ) {

			let totalDim = 0;
			for ( const dim of listOfDimensions ) {

				totalDim += dim;

			}

			const combined = new Float32Array( totalDim );
			const strataObjs = [];
			let offset = 0;
			for ( const dim of listOfDimensions ) {

				const sampler = new StratifiedSampler( strataCount, dim, random );
				sampler.samples = new Float32Array( combined.buffer, offset, sampler.samples.length );
				offset += sampler.samples.length * 4;
				strataObjs.push( sampler );

			}

			this.samples = combined;

			this.strataCount = strataCount;

			this.next = function () {

				for ( const strata of strataObjs ) {

					strata.next();

				}

				return combined;

			};

			this.reshuffle = function () {

				for ( const strata of strataObjs ) {

					strata.reshuffle();

				}

			};

			this.reset = function () {

				for ( const strata of strataObjs ) {

					strata.reset();

				}

			};

		}

	}

	// https://stackoverflow.com/questions/424292/seedable-javascript-random-number-generator
	class RandomGenerator {

		constructor( seed = 0 ) {

			// LCG using GCC's constants
			this.m = 0x80000000; // 2**31;
			this.a = 1103515245;
			this.c = 12345;

			this.seed = seed;

		}

		nextInt() {

			this.seed = ( this.a * this.seed + this.c ) % this.m;
			return this.seed;

		}

		nextFloat() {

			// returns in range [0,1]
			return this.nextInt() / ( this.m - 1 );

		}

	}

	class StratifiedSamplesTexture extends three.DataTexture {

		constructor( count = 1, depth = 1, strata = 8 ) {

			super( new Float32Array( 1 ), 1, 1, three.RGBAFormat, three.FloatType );
			this.minFilter = three.NearestFilter;
			this.magFilter = three.NearestFilter;

			this.strata = strata;
			this.sampler = null;
			this.generator = new RandomGenerator();
			this.stableNoise = false;
			this.random = () => {

				if ( this.stableNoise ) {

					return this.generator.nextFloat();

				} else {

					return Math.random();

				}

			};

			this.init( count, depth, strata );

		}

		init( count = this.image.height, depth = this.image.width, strata = this.strata ) {

			const { image } = this;
			if ( image.width === depth && image.height === count && this.sampler !== null ) {

				return;

			}

			const dimensions = new Array( count * depth ).fill( 4 );
			const sampler = new StratifiedSamplerCombined( strata, dimensions, this.random );

			image.width = depth;
			image.height = count;
			image.data = sampler.samples;

			this.sampler = sampler;

			this.dispose();
			this.next();

		}

		next() {

			this.sampler.next();
			this.needsUpdate = true;

		}

		reset() {

			this.sampler.reset();
			this.generator.seed = 0;

		}

	}

	function shuffleArray( array, random = Math.random ) {

		for ( let i = array.length - 1; i > 0; i -- ) {

			const replaceIndex = ~ ~ ( ( random() - 1e-6 ) * i );
			const tmp = array[ i ];
			array[ i ] = array[ replaceIndex ];
			array[ replaceIndex ] = tmp;

		}

	}

	function fillWithOnes( array, count ) {

		array.fill( 0 );

		for ( let i = 0; i < count; i ++ ) {

			array[ i ] = 1;

		}

	}

	class BlueNoiseSamples {

		constructor( size ) {

			this.count = 0;
			this.size = - 1;
			this.sigma = - 1;
			this.radius = - 1;
			this.lookupTable = null;
			this.score = null;
			this.binaryPattern = null;

			this.resize( size );
			this.setSigma( 1.5 );

		}

		findVoid() {

			const { score, binaryPattern } = this;

			let currValue = Infinity;
			let currIndex = - 1;
			for ( let i = 0, l = binaryPattern.length; i < l; i ++ ) {

				if ( binaryPattern[ i ] !== 0 ) {

					continue;

				}

				const pScore = score[ i ];
				if ( pScore < currValue ) {

					currValue = pScore;
					currIndex = i;

				}

			}

			return currIndex;

		}

		findCluster() {

			const { score, binaryPattern } = this;

			let currValue = - Infinity;
			let currIndex = - 1;
			for ( let i = 0, l = binaryPattern.length; i < l; i ++ ) {

				if ( binaryPattern[ i ] !== 1 ) {

					continue;

				}

				const pScore = score[ i ];
				if ( pScore > currValue ) {

					currValue = pScore;
					currIndex = i;

				}

			}

			return currIndex;

		}

		setSigma( sigma ) {

			if ( sigma === this.sigma ) {

				return;

			}

			// generate a radius in which the score will be updated under the
			// assumption that e^-10 is insignificant enough to be the border at
			// which we drop off.
			const radius = ~ ~ ( Math.sqrt( 10 * 2 * ( sigma ** 2 ) ) + 1 );
			const lookupWidth = 2 * radius + 1;
			const lookupTable = new Float32Array( lookupWidth * lookupWidth );
			const sigma2 = sigma * sigma;
			for ( let x = - radius; x <= radius; x ++ ) {

				for ( let y = - radius; y <= radius; y ++ ) {

					const index = ( radius + y ) * lookupWidth + x + radius;
					const dist2 = x * x + y * y;
					lookupTable[ index ] = Math.E ** ( - dist2 / ( 2 * sigma2 ) );

				}

			}

			this.lookupTable = lookupTable;
			this.sigma = sigma;
			this.radius = radius;

		}

		resize( size ) {

			if ( this.size !== size ) {

				this.size = size;
				this.score = new Float32Array( size * size );
				this.binaryPattern = new Uint8Array( size * size );

			}


		}

		invert() {

			const { binaryPattern, score, size } = this;

			score.fill( 0 );

			for ( let i = 0, l = binaryPattern.length; i < l; i ++ ) {

				if ( binaryPattern[ i ] === 0 ) {

					const y = ~ ~ ( i / size );
					const x = i - y * size;
					this.updateScore( x, y, 1 );
					binaryPattern[ i ] = 1;

				} else {

					binaryPattern[ i ] = 0;

				}

			}

		}

		updateScore( x, y, multiplier ) {

			// TODO: Is there a way to keep track of the highest and lowest scores here to avoid have to search over
			// everything in the buffer?
			const { size, score, lookupTable } = this;

			// const sigma2 = sigma * sigma;
			// const radius = Math.floor( size / 2 );
			const radius = this.radius;
			const lookupWidth = 2 * radius + 1;
			for ( let px = - radius; px <= radius; px ++ ) {

				for ( let py = - radius; py <= radius; py ++ ) {

					// const dist2 = px * px + py * py;
					// const value = Math.E ** ( - dist2 / ( 2 * sigma2 ) );

					const lookupIndex = ( radius + py ) * lookupWidth + px + radius;
					const value = lookupTable[ lookupIndex ];

					let sx = ( x + px );
					sx = sx < 0 ? size + sx : sx % size;

					let sy = ( y + py );
					sy = sy < 0 ? size + sy : sy % size;

					const sindex = sy * size + sx;
					score[ sindex ] += multiplier * value;

				}

			}

		}

		addPointIndex( index ) {

			this.binaryPattern[ index ] = 1;

			const size = this.size;
			const y = ~ ~ ( index / size );
			const x = index - y * size;
			this.updateScore( x, y, 1 );
			this.count ++;

		}

		removePointIndex( index ) {

			this.binaryPattern[ index ] = 0;

			const size = this.size;
			const y = ~ ~ ( index / size );
			const x = index - y * size;
			this.updateScore( x, y, - 1 );
			this.count --;

		}

		copy( source ) {

			this.resize( source.size );
			this.score.set( source.score );
			this.binaryPattern.set( source.binaryPattern );
			this.setSigma( source.sigma );
			this.count = source.count;

		}

	}

	class BlueNoiseGenerator {

		constructor() {

			this.random = Math.random;
			this.sigma = 1.5;
			this.size = 64;
			this.majorityPointsRatio = 0.1;

			this.samples = new BlueNoiseSamples( 1 );
			this.savedSamples = new BlueNoiseSamples( 1 );

		}

		generate() {

			// http://cv.ulichney.com/papers/1993-void-cluster.pdf

			const {
				samples,
				savedSamples,
				sigma,
				majorityPointsRatio,
				size,
			} = this;

			samples.resize( size );
			samples.setSigma( sigma );

			// 1. Randomly place the minority points.
			const pointCount = Math.floor( size * size * majorityPointsRatio );
			const initialSamples = samples.binaryPattern;

			fillWithOnes( initialSamples, pointCount );
			shuffleArray( initialSamples, this.random );

			for ( let i = 0, l = initialSamples.length; i < l; i ++ ) {

				if ( initialSamples[ i ] === 1 ) {

					samples.addPointIndex( i );

				}

			}

			// 2. Remove minority point that is in densest cluster and place it in the largest void.
			while ( true ) {

				const clusterIndex = samples.findCluster();
				samples.removePointIndex( clusterIndex );

				const voidIndex = samples.findVoid();
				if ( clusterIndex === voidIndex ) {

					samples.addPointIndex( clusterIndex );
					break;

				}

				samples.addPointIndex( voidIndex );

			}

			// 3. PHASE I: Assign a rank to each progressively less dense cluster point and put it
			// in the dither array.
			const ditherArray = new Uint32Array( size * size );
			savedSamples.copy( samples );

			let rank;
			rank = samples.count - 1;
			while ( rank >= 0 ) {

				const clusterIndex = samples.findCluster();
				samples.removePointIndex( clusterIndex );

				ditherArray[ clusterIndex ] = rank;
				rank --;

			}

			// 4. PHASE II: Do the same thing for the largest voids up to half of the total pixels using
			// the initial binary pattern.
			const totalSize = size * size;
			rank = savedSamples.count;
			while ( rank < totalSize / 2 ) {

				const voidIndex = savedSamples.findVoid();
				savedSamples.addPointIndex( voidIndex );
				ditherArray[ voidIndex ] = rank;
				rank ++;

			}

			// 5. PHASE III: Invert the pattern and finish out by assigning a rank to the remaining
			// and iteratively removing them.
			savedSamples.invert();

			while ( rank < totalSize ) {

				const clusterIndex = savedSamples.findCluster();
				savedSamples.removePointIndex( clusterIndex );
				ditherArray[ clusterIndex ] = rank;
				rank ++;

			}

			return { data: ditherArray, maxValue: totalSize };

		}

	}

	function getStride( channels ) {

		if ( channels >= 3 ) {

			return 4;

		} else {

			return channels;

		}

	}

	function getFormat( channels ) {

		switch ( channels ) {

		case 1:
			return three.RedFormat;
		case 2:
			return three.RGFormat;
		default:
			return three.RGBAFormat;

		}

	}

	class BlueNoiseTexture extends three.DataTexture {

		constructor( size = 64, channels = 1 ) {

			super( new Float32Array( 4 ), 1, 1, three.RGBAFormat, three.FloatType );
			this.minFilter = three.NearestFilter;
			this.magFilter = three.NearestFilter;

			this.size = size;
			this.channels = channels;
			this.update();

		}

		update() {

			const channels = this.channels;
			const size = this.size;
			const generator = new BlueNoiseGenerator();
			generator.channels = channels;
			generator.size = size;

			const stride = getStride( channels );
			const format = getFormat( stride );
			if ( this.image.width !== size || format !== this.format ) {

				this.image.width = size;
				this.image.height = size;
				this.image.data = new Float32Array( ( size ** 2 ) * stride );
				this.format = format;
				this.dispose();

			}

			const data = this.image.data;
			for ( let i = 0, l = channels; i < l; i ++ ) {

				const result = generator.generate();
				const bin = result.data;
				const maxValue = result.maxValue;

				for ( let j = 0, l2 = bin.length; j < l2; j ++ ) {

					const value = bin[ j ] / maxValue;
					data[ j * stride + i ] = value;

				}

			}

			this.needsUpdate = true;

		}

	}

	const camera_struct = /* glsl */`

	struct PhysicalCamera {

		float focusDistance;
		float anamorphicRatio;
		float bokehSize;
		int apertureBlades;
		float apertureRotation;

	};

`;

	const equirect_struct = /* glsl */`

	struct EquirectHdrInfo {

		sampler2D marginalWeights;
		sampler2D conditionalWeights;
		sampler2D map;

		float totalSum;

	};

`;

	const lights_struct = /* glsl */`

	#define RECT_AREA_LIGHT_TYPE 0
	#define CIRC_AREA_LIGHT_TYPE 1
	#define SPOT_LIGHT_TYPE 2
	#define DIR_LIGHT_TYPE 3
	#define POINT_LIGHT_TYPE 4

	struct LightsInfo {

		sampler2D tex;
		uint count;

	};

	struct Light {

		vec3 position;
		int type;

		vec3 color;
		float intensity;

		vec3 u;
		vec3 v;
		float area;

		// spot light fields
		float radius;
		float near;
		float decay;
		float distance;
		float coneCos;
		float penumbraCos;
		int iesProfile;

	};

	Light readLightInfo( sampler2D tex, uint index ) {

		uint i = index * 6u;

		vec4 s0 = texelFetch1D( tex, i + 0u );
		vec4 s1 = texelFetch1D( tex, i + 1u );
		vec4 s2 = texelFetch1D( tex, i + 2u );
		vec4 s3 = texelFetch1D( tex, i + 3u );

		Light l;
		l.position = s0.rgb;
		l.type = int( round( s0.a ) );

		l.color = s1.rgb;
		l.intensity = s1.a;

		l.u = s2.rgb;
		l.v = s3.rgb;
		l.area = s3.a;

		if ( l.type == SPOT_LIGHT_TYPE || l.type == POINT_LIGHT_TYPE ) {

			vec4 s4 = texelFetch1D( tex, i + 4u );
			vec4 s5 = texelFetch1D( tex, i + 5u );
			l.radius = s4.r;
			l.decay = s4.g;
			l.distance = s4.b;
			l.coneCos = s4.a;

			l.penumbraCos = s5.r;
			l.iesProfile = int( round( s5.g ) );

		} else {

			l.radius = 0.0;
			l.decay = 0.0;
			l.distance = 0.0;

			l.coneCos = 0.0;
			l.penumbraCos = 0.0;
			l.iesProfile = - 1;

		}

		return l;

	}

`;

	const material_struct = /* glsl */ `

	struct Material {

		vec3 color;
		int map;

		float metalness;
		int metalnessMap;

		float roughness;
		int roughnessMap;

		float ior;
		float transmission;
		int transmissionMap;

		float emissiveIntensity;
		vec3 emissive;
		int emissiveMap;

		int normalMap;
		vec2 normalScale;

		float clearcoat;
		int clearcoatMap;
		int clearcoatNormalMap;
		vec2 clearcoatNormalScale;
		float clearcoatRoughness;
		int clearcoatRoughnessMap;

		int iridescenceMap;
		int iridescenceThicknessMap;
		float iridescence;
		float iridescenceIor;
		float iridescenceThicknessMinimum;
		float iridescenceThicknessMaximum;

		vec3 specularColor;
		int specularColorMap;

		float specularIntensity;
		int specularIntensityMap;
		bool thinFilm;

		vec3 attenuationColor;
		float attenuationDistance;

		int alphaMap;

		bool castShadow;
		float opacity;
		float alphaTest;

		float side;
		bool matte;

		float sheen;
		vec3 sheenColor;
		int sheenColorMap;
		float sheenRoughness;
		int sheenRoughnessMap;

		bool vertexColors;
		bool flatShading;
		bool transparent;
		bool fogVolume;

		mat3 mapTransform;
		mat3 metalnessMapTransform;
		mat3 roughnessMapTransform;
		mat3 transmissionMapTransform;
		mat3 emissiveMapTransform;
		mat3 normalMapTransform;
		mat3 clearcoatMapTransform;
		mat3 clearcoatNormalMapTransform;
		mat3 clearcoatRoughnessMapTransform;
		mat3 sheenColorMapTransform;
		mat3 sheenRoughnessMapTransform;
		mat3 iridescenceMapTransform;
		mat3 iridescenceThicknessMapTransform;
		mat3 specularColorMapTransform;
		mat3 specularIntensityMapTransform;

	};

	mat3 readTextureTransform( sampler2D tex, uint index ) {

		mat3 textureTransform;

		vec4 row1 = texelFetch1D( tex, index );
		vec4 row2 = texelFetch1D( tex, index + 1u );

		textureTransform[0] = vec3(row1.r, row2.r, 0.0);
		textureTransform[1] = vec3(row1.g, row2.g, 0.0);
		textureTransform[2] = vec3(row1.b, row2.b, 1.0);

		return textureTransform;

	}

	Material readMaterialInfo( sampler2D tex, uint index ) {

		uint i = index * 45u;

		vec4 s0 = texelFetch1D( tex, i + 0u );
		vec4 s1 = texelFetch1D( tex, i + 1u );
		vec4 s2 = texelFetch1D( tex, i + 2u );
		vec4 s3 = texelFetch1D( tex, i + 3u );
		vec4 s4 = texelFetch1D( tex, i + 4u );
		vec4 s5 = texelFetch1D( tex, i + 5u );
		vec4 s6 = texelFetch1D( tex, i + 6u );
		vec4 s7 = texelFetch1D( tex, i + 7u );
		vec4 s8 = texelFetch1D( tex, i + 8u );
		vec4 s9 = texelFetch1D( tex, i + 9u );
		vec4 s10 = texelFetch1D( tex, i + 10u );
		vec4 s11 = texelFetch1D( tex, i + 11u );
		vec4 s12 = texelFetch1D( tex, i + 12u );
		vec4 s13 = texelFetch1D( tex, i + 13u );
		vec4 s14 = texelFetch1D( tex, i + 14u );

		Material m;
		m.color = s0.rgb;
		m.map = int( round( s0.a ) );

		m.metalness = s1.r;
		m.metalnessMap = int( round( s1.g ) );
		m.roughness = s1.b;
		m.roughnessMap = int( round( s1.a ) );

		m.ior = s2.r;
		m.transmission = s2.g;
		m.transmissionMap = int( round( s2.b ) );
		m.emissiveIntensity = s2.a;

		m.emissive = s3.rgb;
		m.emissiveMap = int( round( s3.a ) );

		m.normalMap = int( round( s4.r ) );
		m.normalScale = s4.gb;

		m.clearcoat = s4.a;
		m.clearcoatMap = int( round( s5.r ) );
		m.clearcoatRoughness = s5.g;
		m.clearcoatRoughnessMap = int( round( s5.b ) );
		m.clearcoatNormalMap = int( round( s5.a ) );
		m.clearcoatNormalScale = s6.rg;

		m.sheen = s6.a;
		m.sheenColor = s7.rgb;
		m.sheenColorMap = int( round( s7.a ) );
		m.sheenRoughness = s8.r;
		m.sheenRoughnessMap = int( round( s8.g ) );

		m.iridescenceMap = int( round( s8.b ) );
		m.iridescenceThicknessMap = int( round( s8.a ) );
		m.iridescence = s9.r;
		m.iridescenceIor = s9.g;
		m.iridescenceThicknessMinimum = s9.b;
		m.iridescenceThicknessMaximum = s9.a;

		m.specularColor = s10.rgb;
		m.specularColorMap = int( round( s10.a ) );

		m.specularIntensity = s11.r;
		m.specularIntensityMap = int( round( s11.g ) );
		m.thinFilm = bool( s11.b );

		m.attenuationColor = s12.rgb;
		m.attenuationDistance = s12.a;

		m.alphaMap = int( round( s13.r ) );

		m.opacity = s13.g;
		m.alphaTest = s13.b;
		m.side = s13.a;

		m.matte = bool( s14.r );
		m.castShadow = bool( s14.g );
		m.vertexColors = bool( int( s14.b ) & 1 );
		m.flatShading = bool( int( s14.b ) & 2 );
		m.fogVolume = bool( int( s14.b ) & 4 );
		m.transparent = bool( s14.a );

		uint firstTextureTransformIdx = i + 15u;

		// mat3( 1.0 ) is an identity matrix
		m.mapTransform = m.map == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx );
		m.metalnessMapTransform = m.metalnessMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 2u );
		m.roughnessMapTransform = m.roughnessMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 4u );
		m.transmissionMapTransform = m.transmissionMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 6u );
		m.emissiveMapTransform = m.emissiveMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 8u );
		m.normalMapTransform = m.normalMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 10u );
		m.clearcoatMapTransform = m.clearcoatMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 12u );
		m.clearcoatNormalMapTransform = m.clearcoatNormalMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 14u );
		m.clearcoatRoughnessMapTransform = m.clearcoatRoughnessMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 16u );
		m.sheenColorMapTransform = m.sheenColorMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 18u );
		m.sheenRoughnessMapTransform = m.sheenRoughnessMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 20u );
		m.iridescenceMapTransform = m.iridescenceMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 22u );
		m.iridescenceThicknessMapTransform = m.iridescenceThicknessMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 24u );
		m.specularColorMapTransform = m.specularColorMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 26u );
		m.specularIntensityMapTransform = m.specularIntensityMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 28u );

		return m;

	}

`;

	const surface_record_struct = /* glsl */`

	struct SurfaceRecord {

		// surface type
		bool volumeParticle;

		// geometry
		vec3 faceNormal;
		bool frontFace;
		vec3 normal;
		mat3 normalBasis;
		mat3 normalInvBasis;

		// cached properties
		float eta;
		float f0;

		// material
		float roughness;
		float filteredRoughness;
		float metalness;
		vec3 color;
		vec3 emission;

		// transmission
		float ior;
		float transmission;
		bool thinFilm;
		vec3 attenuationColor;
		float attenuationDistance;

		// clearcoat
		vec3 clearcoatNormal;
		mat3 clearcoatBasis;
		mat3 clearcoatInvBasis;
		float clearcoat;
		float clearcoatRoughness;
		float filteredClearcoatRoughness;

		// sheen
		float sheen;
		vec3 sheenColor;
		float sheenRoughness;

		// iridescence
		float iridescence;
		float iridescenceIor;
		float iridescenceThickness;

		// specular
		vec3 specularColor;
		float specularIntensity;
	};

	struct ScatterRecord {
		float specularPdf;
		float pdf;
		vec3 direction;
		vec3 color;
	};

`;

	const equirect_functions = /* glsl */`

	// samples the the given environment map in the given direction
	vec3 sampleEquirectColor( sampler2D envMap, vec3 direction ) {

		return texture2D( envMap, equirectDirectionToUv( direction ) ).rgb;

	}

	// gets the pdf of the given direction to sample
	float equirectDirectionPdf( vec3 direction ) {

		vec2 uv = equirectDirectionToUv( direction );
		float theta = uv.y * PI;
		float sinTheta = sin( theta );
		if ( sinTheta == 0.0 ) {

			return 0.0;

		}

		return 1.0 / ( 2.0 * PI * PI * sinTheta );

	}

	// samples the color given env map with CDF and returns the pdf of the direction
	float sampleEquirect( vec3 direction, inout vec3 color ) {

		float totalSum = envMapInfo.totalSum;
		if ( totalSum == 0.0 ) {

			color = vec3( 0.0 );
			return 1.0;

		}

		vec2 uv = equirectDirectionToUv( direction );
		color = texture2D( envMapInfo.map, uv ).rgb;

		float lum = luminance( color );
		ivec2 resolution = textureSize( envMapInfo.map, 0 );
		float pdf = lum / totalSum;

		return float( resolution.x * resolution.y ) * pdf * equirectDirectionPdf( direction );

	}

	// samples a direction of the envmap with color and retrieves pdf
	float sampleEquirectProbability( vec2 r, inout vec3 color, inout vec3 direction ) {

		// sample env map cdf
		float v = texture2D( envMapInfo.marginalWeights, vec2( r.x, 0.0 ) ).x;
		float u = texture2D( envMapInfo.conditionalWeights, vec2( r.y, v ) ).x;
		vec2 uv = vec2( u, v );

		vec3 derivedDirection = equirectUvToDirection( uv );
		direction = derivedDirection;
		color = texture2D( envMapInfo.map, uv ).rgb;

		float totalSum = envMapInfo.totalSum;
		float lum = luminance( color );
		ivec2 resolution = textureSize( envMapInfo.map, 0 );
		float pdf = lum / totalSum;

		return float( resolution.x * resolution.y ) * pdf * equirectDirectionPdf( direction );

	}
`;

	const light_sampling_functions = /* glsl */`

	float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {

		return smoothstep( coneCosine, penumbraCosine, angleCosine );

	}

	float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {

		// based upon Frostbite 3 Moving to Physically-based Rendering
		// page 32, equation 26: E[window1]
		// https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf
		float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), EPSILON );

		if ( cutoffDistance > 0.0 ) {

			distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );

		}

		return distanceFalloff;

	}

	float getPhotometricAttenuation( sampler2DArray iesProfiles, int iesProfile, vec3 posToLight, vec3 lightDir, vec3 u, vec3 v ) {

		float cosTheta = dot( posToLight, lightDir );
		float angle = acos( cosTheta ) / PI;

		return texture2D( iesProfiles, vec3( angle, 0.0, iesProfile ) ).r;

	}

	struct LightRecord {

		float dist;
		vec3 direction;
		float pdf;
		vec3 emission;
		int type;

	};

	bool intersectLightAtIndex( sampler2D lights, vec3 rayOrigin, vec3 rayDirection, uint l, inout LightRecord lightRec ) {

		bool didHit = false;
		Light light = readLightInfo( lights, l );

		vec3 u = light.u;
		vec3 v = light.v;

		// check for backface
		vec3 normal = normalize( cross( u, v ) );
		if ( dot( normal, rayDirection ) > 0.0 ) {

			u *= 1.0 / dot( u, u );
			v *= 1.0 / dot( v, v );

			float dist;

			// MIS / light intersection is not supported for punctual lights.
			if(
				( light.type == RECT_AREA_LIGHT_TYPE && intersectsRectangle( light.position, normal, u, v, rayOrigin, rayDirection, dist ) ) ||
				( light.type == CIRC_AREA_LIGHT_TYPE && intersectsCircle( light.position, normal, u, v, rayOrigin, rayDirection, dist ) )
			) {

				float cosTheta = dot( rayDirection, normal );
				didHit = true;
				lightRec.dist = dist;
				lightRec.pdf = ( dist * dist ) / ( light.area * cosTheta );
				lightRec.emission = light.color * light.intensity;
				lightRec.direction = rayDirection;
				lightRec.type = light.type;

			}

		}

		return didHit;

	}

	LightRecord randomAreaLightSample( Light light, vec3 rayOrigin, vec2 ruv ) {

		vec3 randomPos;
		if( light.type == RECT_AREA_LIGHT_TYPE ) {

			// rectangular area light
			randomPos = light.position + light.u * ( ruv.x - 0.5 ) + light.v * ( ruv.y - 0.5 );

		} else if( light.type == CIRC_AREA_LIGHT_TYPE ) {

			// circular area light
			float r = 0.5 * sqrt( ruv.x );
			float theta = ruv.y * 2.0 * PI;
			float x = r * cos( theta );
			float y = r * sin( theta );

			randomPos = light.position + light.u * x + light.v * y;

		}

		vec3 toLight = randomPos - rayOrigin;
		float lightDistSq = dot( toLight, toLight );
		float dist = sqrt( lightDistSq );
		vec3 direction = toLight / dist;
		vec3 lightNormal = normalize( cross( light.u, light.v ) );

		LightRecord lightRec;
		lightRec.type = light.type;
		lightRec.emission = light.color * light.intensity;
		lightRec.dist = dist;
		lightRec.direction = direction;

		// TODO: the denominator is potentially zero
		lightRec.pdf = lightDistSq / ( light.area * dot( direction, lightNormal ) );

		return lightRec;

	}

	LightRecord randomSpotLightSample( Light light, sampler2DArray iesProfiles, vec3 rayOrigin, vec2 ruv ) {

		float radius = light.radius * sqrt( ruv.x );
		float theta = ruv.y * 2.0 * PI;
		float x = radius * cos( theta );
		float y = radius * sin( theta );

		vec3 u = light.u;
		vec3 v = light.v;
		vec3 normal = normalize( cross( u, v ) );

		float angle = acos( light.coneCos );
		float angleTan = tan( angle );
		float startDistance = light.radius / max( angleTan, EPSILON );

		vec3 randomPos = light.position - normal * startDistance + u * x + v * y;
		vec3 toLight = randomPos - rayOrigin;
		float lightDistSq = dot( toLight, toLight );
		float dist = sqrt( lightDistSq );

		vec3 direction = toLight / max( dist, EPSILON );
		float cosTheta = dot( direction, normal );

		float spotAttenuation = light.iesProfile != - 1 ?
			getPhotometricAttenuation( iesProfiles, light.iesProfile, direction, normal, u, v ) :
			getSpotAttenuation( light.coneCos, light.penumbraCos, cosTheta );

		float distanceAttenuation = getDistanceAttenuation( dist, light.distance, light.decay );
		LightRecord lightRec;
		lightRec.type = light.type;
		lightRec.dist = dist;
		lightRec.direction = direction;
		lightRec.emission = light.color * light.intensity * distanceAttenuation * spotAttenuation;
		lightRec.pdf = 1.0;

		return lightRec;

	}

	LightRecord randomLightSample( sampler2D lights, sampler2DArray iesProfiles, uint lightCount, vec3 rayOrigin, vec3 ruv ) {

		LightRecord result;

		// pick a random light
		uint l = uint( ruv.x * float( lightCount ) );
		Light light = readLightInfo( lights, l );

		if ( light.type == SPOT_LIGHT_TYPE ) {

			result = randomSpotLightSample( light, iesProfiles, rayOrigin, ruv.yz );

		} else if ( light.type == POINT_LIGHT_TYPE ) {

			vec3 lightRay = light.u - rayOrigin;
			float lightDist = length( lightRay );
			float cutoffDistance = light.distance;
			float distanceFalloff = 1.0 / max( pow( lightDist, light.decay ), 0.01 );
			if ( cutoffDistance > 0.0 ) {

				distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDist / cutoffDistance ) ) );

			}

			LightRecord rec;
			rec.direction = normalize( lightRay );
			rec.dist = length( lightRay );
			rec.pdf = 1.0;
			rec.emission = light.color * light.intensity * distanceFalloff;
			rec.type = light.type;
			result = rec;

		} else if ( light.type == DIR_LIGHT_TYPE ) {

			LightRecord rec;
			rec.dist = 1e10;
			rec.direction = light.u;
			rec.pdf = 1.0;
			rec.emission = light.color * light.intensity;
			rec.type = light.type;

			result = rec;

		} else {

			// sample the light
			result = randomAreaLightSample( light, rayOrigin, ruv.yz );

		}

		return result;

	}

`;

	const shape_sampling_functions = /* glsl */`

	vec3 sampleHemisphere( vec3 n, vec2 uv ) {

		// https://www.rorydriscoll.com/2009/01/07/better-sampling/
		// https://graphics.pixar.com/library/OrthonormalB/paper.pdf
		float sign = n.z == 0.0 ? 1.0 : sign( n.z );
		float a = - 1.0 / ( sign + n.z );
		float b = n.x * n.y * a;
		vec3 b1 = vec3( 1.0 + sign * n.x * n.x * a, sign * b, - sign * n.x );
		vec3 b2 = vec3( b, sign + n.y * n.y * a, - n.y );

		float r = sqrt( uv.x );
		float theta = 2.0 * PI * uv.y;
		float x = r * cos( theta );
		float y = r * sin( theta );
		return x * b1 + y * b2 + sqrt( 1.0 - uv.x ) * n;

	}

	vec2 sampleTriangle( vec2 a, vec2 b, vec2 c, vec2 r ) {

		// get the edges of the triangle and the diagonal across the
		// center of the parallelogram
		vec2 e1 = a - b;
		vec2 e2 = c - b;
		vec2 diag = normalize( e1 + e2 );

		// pick the point in the parallelogram
		if ( r.x + r.y > 1.0 ) {

			r = vec2( 1.0 ) - r;

		}

		return e1 * r.x + e2 * r.y;

	}

	vec2 sampleCircle( vec2 uv ) {

		float angle = 2.0 * PI * uv.x;
		float radius = sqrt( uv.y );
		return vec2( cos( angle ), sin( angle ) ) * radius;

	}

	vec3 sampleSphere( vec2 uv ) {

		float u = ( uv.x - 0.5 ) * 2.0;
		float t = uv.y * PI * 2.0;
		float f = sqrt( 1.0 - u * u );

		return vec3( f * cos( t ), f * sin( t ), u );

	}

	vec2 sampleRegularPolygon( int sides, vec3 uvw ) {

		sides = max( sides, 3 );

		vec3 r = uvw;
		float anglePerSegment = 2.0 * PI / float( sides );
		float segment = floor( float( sides ) * r.x );

		float angle1 = anglePerSegment * segment;
		float angle2 = angle1 + anglePerSegment;
		vec2 a = vec2( sin( angle1 ), cos( angle1 ) );
		vec2 b = vec2( 0.0, 0.0 );
		vec2 c = vec2( sin( angle2 ), cos( angle2 ) );

		return sampleTriangle( a, b, c, r.yz );

	}

	// samples an aperture shape with the given number of sides. 0 means circle
	vec2 sampleAperture( int blades, vec3 uvw ) {

		return blades == 0 ?
			sampleCircle( uvw.xy ) :
			sampleRegularPolygon( blades, uvw );

	}


`;

	const fresnel_functions = /* glsl */`

	bool totalInternalReflection( float cosTheta, float eta ) {

		float sinTheta = sqrt( 1.0 - cosTheta * cosTheta );
		return eta * sinTheta > 1.0;

	}

	// https://google.github.io/filament/Filament.md.html#materialsystem/diffusebrdf
	float schlickFresnel( float cosine, float f0 ) {

		return f0 + ( 1.0 - f0 ) * pow( 1.0 - cosine, 5.0 );

	}

	vec3 schlickFresnel( float cosine, vec3 f0 ) {

		return f0 + ( 1.0 - f0 ) * pow( 1.0 - cosine, 5.0 );

	}

	vec3 schlickFresnel( float cosine, vec3 f0, vec3 f90 ) {

		return f0 + ( f90 - f0 ) * pow( 1.0 - cosine, 5.0 );

	}

	float dielectricFresnel( float cosThetaI, float eta ) {

		// https://schuttejoe.github.io/post/disneybsdf/
		float ni = eta;
		float nt = 1.0;

		// Check for total internal reflection
		float sinThetaISq = 1.0f - cosThetaI * cosThetaI;
		float sinThetaTSq = eta * eta * sinThetaISq;
		if( sinThetaTSq >= 1.0 ) {

			return 1.0;

		}

		float sinThetaT = sqrt( sinThetaTSq );

		float cosThetaT = sqrt( max( 0.0, 1.0f - sinThetaT * sinThetaT ) );
		float rParallel = ( ( nt * cosThetaI ) - ( ni * cosThetaT ) ) / ( ( nt * cosThetaI ) + ( ni * cosThetaT ) );
		float rPerpendicular = ( ( ni * cosThetaI ) - ( nt * cosThetaT ) ) / ( ( ni * cosThetaI ) + ( nt * cosThetaT ) );
		return ( rParallel * rParallel + rPerpendicular * rPerpendicular ) / 2.0;

	}

	// https://raytracing.github.io/books/RayTracingInOneWeekend.html#dielectrics/schlickapproximation
	float iorRatioToF0( float eta ) {

		return pow( ( 1.0 - eta ) / ( 1.0 + eta ), 2.0 );

	}

	vec3 evaluateFresnel( float cosTheta, float eta, vec3 f0, vec3 f90 ) {

		if ( totalInternalReflection( cosTheta, eta ) ) {

			return f90;

		}

		return schlickFresnel( cosTheta, f0, f90 );

	}

	// TODO: disney fresnel was removed and replaced with this fresnel function to better align with
	// the glTF but is causing blown out pixels. Should be revisited
	// float evaluateFresnelWeight( float cosTheta, float eta, float f0 ) {

	// 	if ( totalInternalReflection( cosTheta, eta ) ) {

	// 		return 1.0;

	// 	}

	// 	return schlickFresnel( cosTheta, f0 );

	// }

	// https://schuttejoe.github.io/post/disneybsdf/
	float disneyFresnel( vec3 wo, vec3 wi, vec3 wh, float f0, float eta, float metalness ) {

		float dotHV = dot( wo, wh );
		if ( totalInternalReflection( dotHV, eta ) ) {

			return 1.0;

		}

		float dotHL = dot( wi, wh );
		float dielectricFresnel = dielectricFresnel( abs( dotHV ), eta );
		float metallicFresnel = schlickFresnel( dotHL, f0 );

		return mix( dielectricFresnel, metallicFresnel, metalness );

	}

`;

	const math_functions = /* glsl */`

	// Fast arccos approximation used to remove banding artifacts caused by numerical errors in acos.
	// This is a cubic Lagrange interpolating polynomial for x = [-1, -1/2, 0, 1/2, 1].
	// For more information see: https://github.com/gkjohnson/three-gpu-pathtracer/pull/171#issuecomment-1152275248
	float acosApprox( float x ) {

		x = clamp( x, -1.0, 1.0 );
		return ( - 0.69813170079773212 * x * x - 0.87266462599716477 ) * x + 1.5707963267948966;

	}

	// An acos with input values bound to the range [-1, 1].
	float acosSafe( float x ) {

		return acos( clamp( x, -1.0, 1.0 ) );

	}

	float saturateCos( float val ) {

		return clamp( val, 0.001, 1.0 );

	}

	float square( float t ) {

		return t * t;

	}

	vec2 square( vec2 t ) {

		return t * t;

	}

	vec3 square( vec3 t ) {

		return t * t;

	}

	vec4 square( vec4 t ) {

		return t * t;

	}

	vec2 rotateVector( vec2 v, float t ) {

		float ac = cos( t );
		float as = sin( t );
		return vec2(
			v.x * ac - v.y * as,
			v.x * as + v.y * ac
		);

	}

	// forms a basis with the normal vector as Z
	mat3 getBasisFromNormal( vec3 normal ) {

		vec3 other;
		if ( abs( normal.x ) > 0.5 ) {

			other = vec3( 0.0, 1.0, 0.0 );

		} else {

			other = vec3( 1.0, 0.0, 0.0 );

		}

		vec3 ortho = normalize( cross( normal, other ) );
		vec3 ortho2 = normalize( cross( normal, ortho ) );
		return mat3( ortho2, ortho, normal );

	}

`;

	const shape_intersection_functions = /* glsl */`

	// Finds the point where the ray intersects the plane defined by u and v and checks if this point
	// falls in the bounds of the rectangle on that same plane.
	// Plane intersection: https://lousodrome.net/blog/light/2020/07/03/intersection-of-a-ray-and-a-plane/
	bool intersectsRectangle( vec3 center, vec3 normal, vec3 u, vec3 v, vec3 rayOrigin, vec3 rayDirection, inout float dist ) {

		float t = dot( center - rayOrigin, normal ) / dot( rayDirection, normal );

		if ( t > EPSILON ) {

			vec3 p = rayOrigin + rayDirection * t;
			vec3 vi = p - center;

			// check if p falls inside the rectangle
			float a1 = dot( u, vi );
			if ( abs( a1 ) <= 0.5 ) {

				float a2 = dot( v, vi );
				if ( abs( a2 ) <= 0.5 ) {

					dist = t;
					return true;

				}

			}

		}

		return false;

	}

	// Finds the point where the ray intersects the plane defined by u and v and checks if this point
	// falls in the bounds of the circle on that same plane. See above URL for a description of the plane intersection algorithm.
	bool intersectsCircle( vec3 position, vec3 normal, vec3 u, vec3 v, vec3 rayOrigin, vec3 rayDirection, inout float dist ) {

		float t = dot( position - rayOrigin, normal ) / dot( rayDirection, normal );

		if ( t > EPSILON ) {

			vec3 hit = rayOrigin + rayDirection * t;
			vec3 vi = hit - position;

			float a1 = dot( u, vi );
			float a2 = dot( v, vi );

			if( length( vec2( a1, a2 ) ) <= 0.5 ) {

				dist = t;
				return true;

			}

		}

		return false;

	}

`;

	const texture_sample_functions = /*glsl */`

	// add texel fetch functions for texture arrays
	vec4 texelFetch1D( sampler2DArray tex, int layer, uint index ) {

		uint width = uint( textureSize( tex, 0 ).x );
		uvec2 uv;
		uv.x = index % width;
		uv.y = index / width;

		return texelFetch( tex, ivec3( uv, layer ), 0 );

	}

	vec4 textureSampleBarycoord( sampler2DArray tex, int layer, vec3 barycoord, uvec3 faceIndices ) {

		return
			barycoord.x * texelFetch1D( tex, layer, faceIndices.x ) +
			barycoord.y * texelFetch1D( tex, layer, faceIndices.y ) +
			barycoord.z * texelFetch1D( tex, layer, faceIndices.z );

	}

`;

	const util_functions = /* glsl */`

	// TODO: possibly this should be renamed something related to material or path tracing logic

	#ifndef RAY_OFFSET
	#define RAY_OFFSET 1e-4
	#endif

	// adjust the hit point by the surface normal by a factor of some offset and the
	// maximum component-wise value of the current point to accommodate floating point
	// error as values increase.
	vec3 stepRayOrigin( vec3 rayOrigin, vec3 rayDirection, vec3 offset, float dist ) {

		vec3 point = rayOrigin + rayDirection * dist;
		vec3 absPoint = abs( point );
		float maxPoint = max( absPoint.x, max( absPoint.y, absPoint.z ) );
		return point + offset * ( maxPoint + 1.0 ) * RAY_OFFSET;

	}

	// https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_volume/README.md#attenuation
	vec3 transmissionAttenuation( float dist, vec3 attColor, float attDist ) {

		vec3 ot = - log( attColor ) / attDist;
		return exp( - ot * dist );

	}

	vec3 getHalfVector( vec3 wi, vec3 wo, float eta ) {

		// get the half vector - assuming if the light incident vector is on the other side
		// of the that it's transmissive.
		vec3 h;
		if ( wi.z > 0.0 ) {

			h = normalize( wi + wo );

		} else {

			// Scale by the ior ratio to retrieve the appropriate half vector
			// From Section 2.2 on computing the transmission half vector:
			// https://blog.selfshadow.com/publications/s2015-shading-course/burley/s2015_pbs_disney_bsdf_notes.pdf
			h = normalize( wi + wo * eta );

		}

		h *= sign( h.z );
		return h;

	}

	vec3 getHalfVector( vec3 a, vec3 b ) {

		return normalize( a + b );

	}

	// The discrepancy between interpolated surface normal and geometry normal can cause issues when a ray
	// is cast that is on the top side of the geometry normal plane but below the surface normal plane. If
	// we find a ray like that we ignore it to avoid artifacts.
	// This function returns if the direction is on the same side of both planes.
	bool isDirectionValid( vec3 direction, vec3 surfaceNormal, vec3 geometryNormal ) {

		bool aboveSurfaceNormal = dot( direction, surfaceNormal ) > 0.0;
		bool aboveGeometryNormal = dot( direction, geometryNormal ) > 0.0;
		return aboveSurfaceNormal == aboveGeometryNormal;

	}

	// ray sampling x and z are swapped to align with expected background view
	vec2 equirectDirectionToUv( vec3 direction ) {

		// from Spherical.setFromCartesianCoords
		vec2 uv = vec2( atan( direction.z, direction.x ), acos( direction.y ) );
		uv /= vec2( 2.0 * PI, PI );

		// apply adjustments to get values in range [0, 1] and y right side up
		uv.x += 0.5;
		uv.y = 1.0 - uv.y;
		return uv;

	}

	vec3 equirectUvToDirection( vec2 uv ) {

		// undo above adjustments
		uv.x -= 0.5;
		uv.y = 1.0 - uv.y;

		// from Vector3.setFromSphericalCoords
		float theta = uv.x * 2.0 * PI;
		float phi = uv.y * PI;

		float sinPhi = sin( phi );

		return vec3( sinPhi * cos( theta ), cos( phi ), sinPhi * sin( theta ) );

	}

	// power heuristic for multiple importance sampling
	float misHeuristic( float a, float b ) {

		float aa = a * a;
		float bb = b * b;
		return aa / ( aa + bb );

	}

	// tentFilter from Peter Shirley's 'Realistic Ray Tracing (2nd Edition)' book, pg. 60
	// erichlof/THREE.js-PathTracing-Renderer/
	float tentFilter( float x ) {

		return x < 0.5 ? sqrt( 2.0 * x ) - 1.0 : 1.0 - sqrt( 2.0 - ( 2.0 * x ) );

	}
`;

	const pcg_functions = /* glsl */`

	// https://www.shadertoy.com/view/wltcRS
	uvec4 WHITE_NOISE_SEED;

	void rng_initialize( vec2 p, int frame ) {

		// white noise seed
		WHITE_NOISE_SEED = uvec4( p, uint( frame ), uint( p.x ) + uint( p.y ) );

	}

	// https://www.pcg-random.org/
	void pcg4d( inout uvec4 v ) {

		v = v * 1664525u + 1013904223u;
		v.x += v.y * v.w;
		v.y += v.z * v.x;
		v.z += v.x * v.y;
		v.w += v.y * v.z;
		v = v ^ ( v >> 16u );
		v.x += v.y*v.w;
		v.y += v.z*v.x;
		v.z += v.x*v.y;
		v.w += v.y*v.z;

	}

	// returns [ 0, 1 ]
	float pcgRand() {

		pcg4d( WHITE_NOISE_SEED );
		return float( WHITE_NOISE_SEED.x ) / float( 0xffffffffu );

	}

	vec2 pcgRand2() {

		pcg4d( WHITE_NOISE_SEED );
		return vec2( WHITE_NOISE_SEED.xy ) / float(0xffffffffu);

	}

	vec3 pcgRand3() {

		pcg4d( WHITE_NOISE_SEED );
		return vec3( WHITE_NOISE_SEED.xyz ) / float( 0xffffffffu );

	}

	vec4 pcgRand4() {

		pcg4d( WHITE_NOISE_SEED );
		return vec4( WHITE_NOISE_SEED ) / float( 0xffffffffu );

	}
`;

	const stratified_functions = /* glsl */`

	uniform sampler2D stratifiedTexture;
	uniform sampler2D stratifiedOffsetTexture;

	uint sobolPixelIndex = 0u;
	uint sobolPathIndex = 0u;
	uint sobolBounceIndex = 0u;
	vec4 pixelSeed = vec4( 0 );

	vec4 rand4( int v ) {

		ivec2 uv = ivec2( v, sobolBounceIndex );
		vec4 stratifiedSample = texelFetch( stratifiedTexture, uv, 0 );
		return fract( stratifiedSample + pixelSeed.r ); // blue noise + stratified samples

	}

	vec3 rand3( int v ) {

		return rand4( v ).xyz;

	}

	vec2 rand2( int v ) {

		return rand4( v ).xy;

	}

	float rand( int v ) {

		return rand4( v ).x;

	}

	void rng_initialize( vec2 screenCoord, int frame ) {

		// tile the small noise texture across the entire screen
		ivec2 noiseSize = ivec2( textureSize( stratifiedOffsetTexture, 0 ) );
		ivec2 pixel = ivec2( screenCoord.xy ) % noiseSize;
		vec2 pixelWidth = 1.0 / vec2( noiseSize );
		vec2 uv = vec2( pixel ) * pixelWidth + pixelWidth * 0.5;

		// note that using "texelFetch" here seems to break Android for some reason
		pixelSeed = texture( stratifiedOffsetTexture, uv );

	}

`;

	/*
	wi     : incident vector or light vector (pointing toward the light)
	wo     : outgoing vector or view vector (pointing towards the camera)
	wh     : computed half vector from wo and wi
	Eval   : Get the color and pdf for a direction
	Sample : Get the direction, color, and pdf for a sample
	eta    : Greek character used to denote the "ratio of ior"
	f0     : Amount of light reflected when looking at a surface head on - "fresnel 0"
	f90    : Amount of light reflected at grazing angles
	*/

	const bsdf_functions = /* glsl */`

	// diffuse
	float diffuseEval( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf, inout vec3 color ) {

		// https://schuttejoe.github.io/post/disneybsdf/
		float fl = schlickFresnel( wi.z, 0.0 );
		float fv = schlickFresnel( wo.z, 0.0 );

		float metalFactor = ( 1.0 - surf.metalness );
		float transFactor = ( 1.0 - surf.transmission );
		float rr = 0.5 + 2.0 * surf.roughness * fl * fl;
		float retro = rr * ( fl + fv + fl * fv * ( rr - 1.0f ) );
		float lambert = ( 1.0f - 0.5f * fl ) * ( 1.0f - 0.5f * fv );

		// TODO: subsurface approx?

		// float F = evaluateFresnelWeight( dot( wo, wh ), surf.eta, surf.f0 );
		float F = disneyFresnel( wo, wi, wh, surf.f0, surf.eta, surf.metalness );
		color = ( 1.0 - F ) * transFactor * metalFactor * wi.z * surf.color * ( retro + lambert ) / PI;

		return wi.z / PI;

	}

	vec3 diffuseDirection( vec3 wo, SurfaceRecord surf ) {

		vec3 lightDirection = sampleSphere( rand2( 11 ) );
		lightDirection.z += 1.0;
		lightDirection = normalize( lightDirection );

		return lightDirection;

	}

	// specular
	float specularEval( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf, inout vec3 color ) {

		// if roughness is set to 0 then D === NaN which results in black pixels
		float metalness = surf.metalness;
		float roughness = surf.filteredRoughness;

		float eta = surf.eta;
		float f0 = surf.f0;

		vec3 f0Color = mix( f0 * surf.specularColor * surf.specularIntensity, surf.color, surf.metalness );
		vec3 f90Color = vec3( mix( surf.specularIntensity, 1.0, surf.metalness ) );
		vec3 F = evaluateFresnel( dot( wo, wh ), eta, f0Color, f90Color );

		vec3 iridescenceF = evalIridescence( 1.0, surf.iridescenceIor, dot( wi, wh ), surf.iridescenceThickness, f0Color );
		F = mix( F, iridescenceF,  surf.iridescence );

		// PDF
		// See 14.1.1 Microfacet BxDFs in https://www.pbr-book.org/
		float incidentTheta = acos( wo.z );
		float G = ggxShadowMaskG2( wi, wo, roughness );
		float D = ggxDistribution( wh, roughness );
		float G1 = ggxShadowMaskG1( incidentTheta, roughness );
		float ggxPdf = D * G1 * max( 0.0, abs( dot( wo, wh ) ) ) / abs ( wo.z );

		color = wi.z * F * G * D / ( 4.0 * abs( wi.z * wo.z ) );
		return ggxPdf / ( 4.0 * dot( wo, wh ) );

	}

	vec3 specularDirection( vec3 wo, SurfaceRecord surf ) {

		// sample ggx vndf distribution which gives a new normal
		float roughness = surf.filteredRoughness;
		vec3 halfVector = ggxDirection(
			wo,
			vec2( roughness ),
			rand2( 12 )
		);

		// apply to new ray by reflecting off the new normal
		return - reflect( wo, halfVector );

	}


	// transmission
	/*
	float transmissionEval( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf, inout vec3 color ) {

		// See section 4.2 in https://www.cs.cornell.edu/~srm/publications/EGSR07-btdf.pdf

		float filteredRoughness = surf.filteredRoughness;
		float eta = surf.eta;
		bool frontFace = surf.frontFace;
		bool thinFilm = surf.thinFilm;

		color = surf.transmission * surf.color;

		float denom = pow( eta * dot( wi, wh ) + dot( wo, wh ), 2.0 );
		return ggxPDF( wo, wh, filteredRoughness ) / denom;

	}

	vec3 transmissionDirection( vec3 wo, SurfaceRecord surf ) {

		float filteredRoughness = surf.filteredRoughness;
		float eta = surf.eta;
		bool frontFace = surf.frontFace;

		// sample ggx vndf distribution which gives a new normal
		vec3 halfVector = ggxDirection(
			wo,
			vec2( filteredRoughness ),
			rand2( 13 )
		);

		vec3 lightDirection = refract( normalize( - wo ), halfVector, eta );
		if ( surf.thinFilm ) {

			lightDirection = - refract( normalize( - lightDirection ), - vec3( 0.0, 0.0, 1.0 ), 1.0 / eta );

		}

		return normalize( lightDirection );

	}
	*/

	// TODO: This is just using a basic cosine-weighted specular distribution with an
	// incorrect PDF value at the moment. Update it to correctly use a GGX distribution
	float transmissionEval( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf, inout vec3 color ) {

		color = surf.transmission * surf.color;

		// PDF
		// float F = evaluateFresnelWeight( dot( wo, wh ), surf.eta, surf.f0 );
		// float F = disneyFresnel( wo, wi, wh, surf.f0, surf.eta, surf.metalness );
		// if ( F >= 1.0 ) {

		// 	return 0.0;

		// }

		// return 1.0 / ( 1.0 - F );

		// reverted to previous to transmission. The above was causing black pixels
		float eta = surf.eta;
		float f0 = surf.f0;
		float cosTheta = min( wo.z, 1.0 );
		float sinTheta = sqrt( 1.0 - cosTheta * cosTheta );
		float reflectance = schlickFresnel( cosTheta, f0 );
		bool cannotRefract = eta * sinTheta > 1.0;
		if ( cannotRefract ) {

			return 0.0;

		}

		return 1.0 / ( 1.0 - reflectance );

	}

	vec3 transmissionDirection( vec3 wo, SurfaceRecord surf ) {

		float roughness = surf.filteredRoughness;
		float eta = surf.eta;
		vec3 halfVector = normalize( vec3( 0.0, 0.0, 1.0 ) + sampleSphere( rand2( 13 ) ) * roughness );
		vec3 lightDirection = refract( normalize( - wo ), halfVector, eta );

		if ( surf.thinFilm ) {

			lightDirection = - refract( normalize( - lightDirection ), - vec3( 0.0, 0.0, 1.0 ), 1.0 / eta );

		}
		return normalize( lightDirection );

	}

	// clearcoat
	float clearcoatEval( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf, inout vec3 color ) {

		float ior = 1.5;
		float f0 = iorRatioToF0( ior );
		bool frontFace = surf.frontFace;
		float roughness = surf.filteredClearcoatRoughness;

		float eta = frontFace ? 1.0 / ior : ior;
		float G = ggxShadowMaskG2( wi, wo, roughness );
		float D = ggxDistribution( wh, roughness );
		float F = schlickFresnel( dot( wi, wh ), f0 );

		float fClearcoat = F * D * G / ( 4.0 * abs( wi.z * wo.z ) );
		color = color * ( 1.0 - surf.clearcoat * F ) + fClearcoat * surf.clearcoat * wi.z;

		// PDF
		// See equation (27) in http://jcgt.org/published/0003/02/03/
		return ggxPDF( wo, wh, roughness ) / ( 4.0 * dot( wi, wh ) );

	}

	vec3 clearcoatDirection( vec3 wo, SurfaceRecord surf ) {

		// sample ggx vndf distribution which gives a new normal
		float roughness = surf.filteredClearcoatRoughness;
		vec3 halfVector = ggxDirection(
			wo,
			vec2( roughness ),
			rand2( 14 )
		);

		// apply to new ray by reflecting off the new normal
		return - reflect( wo, halfVector );

	}

	// sheen
	vec3 sheenColor( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf ) {

		float cosThetaO = saturateCos( wo.z );
		float cosThetaI = saturateCos( wi.z );
		float cosThetaH = wh.z;

		float D = velvetD( cosThetaH, surf.sheenRoughness );
		float G = velvetG( cosThetaO, cosThetaI, surf.sheenRoughness );

		// See equation (1) in http://www.aconty.com/pdf/s2017_pbs_imageworks_sheen.pdf
		vec3 color = surf.sheenColor;
		color *= D * G / ( 4.0 * abs( cosThetaO * cosThetaI ) );
		color *= wi.z;

		return color;

	}

	// bsdf
	void getLobeWeights(
		vec3 wo, vec3 wi, vec3 wh, vec3 clearcoatWo, SurfaceRecord surf,
		inout float diffuseWeight, inout float specularWeight, inout float transmissionWeight, inout float clearcoatWeight
	) {

		float metalness = surf.metalness;
		float transmission = surf.transmission;
		// float fEstimate = evaluateFresnelWeight( dot( wo, wh ), surf.eta, surf.f0 );
		float fEstimate = disneyFresnel( wo, wi, wh, surf.f0, surf.eta, surf.metalness );

		float transSpecularProb = mix( max( 0.25, fEstimate ), 1.0, metalness );
		float diffSpecularProb = 0.5 + 0.5 * metalness;

		diffuseWeight = ( 1.0 - transmission ) * ( 1.0 - diffSpecularProb );
		specularWeight = transmission * transSpecularProb + ( 1.0 - transmission ) * diffSpecularProb;
		transmissionWeight = transmission * ( 1.0 - transSpecularProb );
		clearcoatWeight = surf.clearcoat * schlickFresnel( clearcoatWo.z, 0.04 );

		float totalWeight = diffuseWeight + specularWeight + transmissionWeight + clearcoatWeight;
		diffuseWeight /= totalWeight;
		specularWeight /= totalWeight;
		transmissionWeight /= totalWeight;
		clearcoatWeight /= totalWeight;
	}

	float bsdfEval(
		vec3 wo, vec3 clearcoatWo, vec3 wi, vec3 clearcoatWi, SurfaceRecord surf,
		float diffuseWeight, float specularWeight, float transmissionWeight, float clearcoatWeight, inout float specularPdf, inout vec3 color
	) {

		float metalness = surf.metalness;
		float transmission = surf.transmission;

		float spdf = 0.0;
		float dpdf = 0.0;
		float tpdf = 0.0;
		float cpdf = 0.0;
		color = vec3( 0.0 );

		vec3 halfVector = getHalfVector( wi, wo, surf.eta );

		// diffuse
		if ( diffuseWeight > 0.0 && wi.z > 0.0 ) {

			dpdf = diffuseEval( wo, wi, halfVector, surf, color );
			color *= 1.0 - surf.transmission;

		}

		// ggx specular
		if ( specularWeight > 0.0 && wi.z > 0.0 ) {

			vec3 outColor;
			spdf = specularEval( wo, wi, getHalfVector( wi, wo ), surf, outColor );
			color += outColor;

		}

		// transmission
		if ( transmissionWeight > 0.0 && wi.z < 0.0 ) {

			tpdf = transmissionEval( wo, wi, halfVector, surf, color );

		}

		// sheen
		color *= mix( 1.0, sheenAlbedoScaling( wo, wi, surf ), surf.sheen );
		color += sheenColor( wo, wi, halfVector, surf ) * surf.sheen;

		// clearcoat
		if ( clearcoatWi.z >= 0.0 && clearcoatWeight > 0.0 ) {

			vec3 clearcoatHalfVector = getHalfVector( clearcoatWo, clearcoatWi );
			cpdf = clearcoatEval( clearcoatWo, clearcoatWi, clearcoatHalfVector, surf, color );

		}

		float pdf =
			dpdf * diffuseWeight
			+ spdf * specularWeight
			+ tpdf * transmissionWeight
			+ cpdf * clearcoatWeight;

		// retrieve specular rays for the shadows flag
		specularPdf = spdf * specularWeight + cpdf * clearcoatWeight;

		return pdf;

	}

	float bsdfResult( vec3 worldWo, vec3 worldWi, SurfaceRecord surf, inout vec3 color ) {

		if ( surf.volumeParticle ) {

			color = surf.color / ( 4.0 * PI );
			return 1.0 / ( 4.0 * PI );

		}

		vec3 wo = normalize( surf.normalInvBasis * worldWo );
		vec3 wi = normalize( surf.normalInvBasis * worldWi );

		vec3 clearcoatWo = normalize( surf.clearcoatInvBasis * worldWo );
		vec3 clearcoatWi = normalize( surf.clearcoatInvBasis * worldWi );

		vec3 wh = getHalfVector( wo, wi, surf.eta );
		float diffuseWeight;
		float specularWeight;
		float transmissionWeight;
		float clearcoatWeight;
		getLobeWeights( wo, wi, wh, clearcoatWo, surf, diffuseWeight, specularWeight, transmissionWeight, clearcoatWeight );

		float specularPdf;
		return bsdfEval( wo, clearcoatWo, wi, clearcoatWi, surf, diffuseWeight, specularWeight, transmissionWeight, clearcoatWeight, specularPdf, color );

	}

	ScatterRecord bsdfSample( vec3 worldWo, SurfaceRecord surf ) {

		if ( surf.volumeParticle ) {

			ScatterRecord sampleRec;
			sampleRec.specularPdf = 0.0;
			sampleRec.pdf = 1.0 / ( 4.0 * PI );
			sampleRec.direction = sampleSphere( rand2( 16 ) );
			sampleRec.color = surf.color / ( 4.0 * PI );
			return sampleRec;

		}

		vec3 wo = normalize( surf.normalInvBasis * worldWo );
		vec3 clearcoatWo = normalize( surf.clearcoatInvBasis * worldWo );
		mat3 normalBasis = surf.normalBasis;
		mat3 invBasis = surf.normalInvBasis;
		mat3 clearcoatNormalBasis = surf.clearcoatBasis;
		mat3 clearcoatInvBasis = surf.clearcoatInvBasis;

		float diffuseWeight;
		float specularWeight;
		float transmissionWeight;
		float clearcoatWeight;
		// using normal and basically-reflected ray since we don't have proper half vector here
		getLobeWeights( wo, wo, vec3( 0, 0, 1 ), clearcoatWo, surf, diffuseWeight, specularWeight, transmissionWeight, clearcoatWeight );

		float pdf[4];
		pdf[0] = diffuseWeight;
		pdf[1] = specularWeight;
		pdf[2] = transmissionWeight;
		pdf[3] = clearcoatWeight;

		float cdf[4];
		cdf[0] = pdf[0];
		cdf[1] = pdf[1] + cdf[0];
		cdf[2] = pdf[2] + cdf[1];
		cdf[3] = pdf[3] + cdf[2];

		if( cdf[3] != 0.0 ) {

			float invMaxCdf = 1.0 / cdf[3];
			cdf[0] *= invMaxCdf;
			cdf[1] *= invMaxCdf;
			cdf[2] *= invMaxCdf;
			cdf[3] *= invMaxCdf;

		} else {

			cdf[0] = 1.0;
			cdf[1] = 0.0;
			cdf[2] = 0.0;
			cdf[3] = 0.0;

		}

		vec3 wi;
		vec3 clearcoatWi;

		float r = rand( 15 );
		if ( r <= cdf[0] ) { // diffuse

			wi = diffuseDirection( wo, surf );
			clearcoatWi = normalize( clearcoatInvBasis * normalize( normalBasis * wi ) );

		} else if ( r <= cdf[1] ) { // specular

			wi = specularDirection( wo, surf );
			clearcoatWi = normalize( clearcoatInvBasis * normalize( normalBasis * wi ) );

		} else if ( r <= cdf[2] ) { // transmission / refraction

			wi = transmissionDirection( wo, surf );
			clearcoatWi = normalize( clearcoatInvBasis * normalize( normalBasis * wi ) );

		} else if ( r <= cdf[3] ) { // clearcoat

			clearcoatWi = clearcoatDirection( clearcoatWo, surf );
			wi = normalize( invBasis * normalize( clearcoatNormalBasis * clearcoatWi ) );

		}

		ScatterRecord result;
		result.pdf = bsdfEval( wo, clearcoatWo, wi, clearcoatWi, surf, diffuseWeight, specularWeight, transmissionWeight, clearcoatWeight, result.specularPdf, result.color );
		result.direction = normalize( surf.normalBasis * wi );

		return result;

	}

`;

	const fog_functions = /* glsl */`

	// returns the hit distance given the material density
	float intersectFogVolume( Material material, float u ) {

		// https://raytracing.github.io/books/RayTracingTheNextWeek.html#volumes/constantdensitymediums
		return material.opacity == 0.0 ? INFINITY : ( - 1.0 / material.opacity ) * log( u );

	}

	ScatterRecord sampleFogVolume( SurfaceRecord surf, vec2 uv ) {

		ScatterRecord sampleRec;
		sampleRec.specularPdf = 0.0;
		sampleRec.pdf = 1.0 / ( 2.0 * PI );
		sampleRec.direction = sampleSphere( uv );
		sampleRec.color = surf.color;
		return sampleRec;

	}

`;

	const ggx_functions = /* glsl */`

	// The GGX functions provide sampling and distribution information for normals as output so
	// in order to get probability of scatter direction the half vector must be computed and provided.
	// [0] https://www.cs.cornell.edu/~srm/publications/EGSR07-btdf.pdf
	// [1] https://hal.archives-ouvertes.fr/hal-01509746/document
	// [2] http://jcgt.org/published/0007/04/01/
	// [4] http://jcgt.org/published/0003/02/03/

	// trowbridge-reitz === GGX === GTR

	vec3 ggxDirection( vec3 incidentDir, vec2 roughness, vec2 uv ) {

		// TODO: try GGXVNDF implementation from reference [2], here. Needs to update ggxDistribution
		// function below, as well

		// Implementation from reference [1]
		// stretch view
		vec3 V = normalize( vec3( roughness * incidentDir.xy, incidentDir.z ) );

		// orthonormal basis
		vec3 T1 = ( V.z < 0.9999 ) ? normalize( cross( V, vec3( 0.0, 0.0, 1.0 ) ) ) : vec3( 1.0, 0.0, 0.0 );
		vec3 T2 = cross( T1, V );

		// sample point with polar coordinates (r, phi)
		float a = 1.0 / ( 1.0 + V.z );
		float r = sqrt( uv.x );
		float phi = ( uv.y < a ) ? uv.y / a * PI : PI + ( uv.y - a ) / ( 1.0 - a ) * PI;
		float P1 = r * cos( phi );
		float P2 = r * sin( phi ) * ( ( uv.y < a ) ? 1.0 : V.z );

		// compute normal
		vec3 N = P1 * T1 + P2 * T2 + V * sqrt( max( 0.0, 1.0 - P1 * P1 - P2 * P2 ) );

		// unstretch
		N = normalize( vec3( roughness * N.xy, max( 0.0, N.z ) ) );

		return N;

	}

	// Below are PDF and related functions for use in a Monte Carlo path tracer
	// as specified in Appendix B of the following paper
	// See equation (34) from reference [0]
	float ggxLamda( float theta, float roughness ) {

		float tanTheta = tan( theta );
		float tanTheta2 = tanTheta * tanTheta;
		float alpha2 = roughness * roughness;

		float numerator = - 1.0 + sqrt( 1.0 + alpha2 * tanTheta2 );
		return numerator / 2.0;

	}

	// See equation (34) from reference [0]
	float ggxShadowMaskG1( float theta, float roughness ) {

		return 1.0 / ( 1.0 + ggxLamda( theta, roughness ) );

	}

	// See equation (125) from reference [4]
	float ggxShadowMaskG2( vec3 wi, vec3 wo, float roughness ) {

		float incidentTheta = acos( wi.z );
		float scatterTheta = acos( wo.z );
		return 1.0 / ( 1.0 + ggxLamda( incidentTheta, roughness ) + ggxLamda( scatterTheta, roughness ) );

	}

	// See equation (33) from reference [0]
	float ggxDistribution( vec3 halfVector, float roughness ) {

		float a2 = roughness * roughness;
		a2 = max( EPSILON, a2 );
		float cosTheta = halfVector.z;
		float cosTheta4 = pow( cosTheta, 4.0 );

		if ( cosTheta == 0.0 ) return 0.0;

		float theta = acosSafe( halfVector.z );
		float tanTheta = tan( theta );
		float tanTheta2 = pow( tanTheta, 2.0 );

		float denom = PI * cosTheta4 * pow( a2 + tanTheta2, 2.0 );
		return ( a2 / denom );

	}

	// See equation (3) from reference [2]
	float ggxPDF( vec3 wi, vec3 halfVector, float roughness ) {

		float incidentTheta = acos( wi.z );
		float D = ggxDistribution( halfVector, roughness );
		float G1 = ggxShadowMaskG1( incidentTheta, roughness );

		return D * G1 * max( 0.0, dot( wi, halfVector ) ) / wi.z;

	}

`;

	const iridescence_functions = /* glsl */`

	// XYZ to sRGB color space
	const mat3 XYZ_TO_REC709 = mat3(
		3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);

	vec3 fresnel0ToIor( vec3 fresnel0 ) {

		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );

	}

	// Conversion FO/IOR
	vec3 iorToFresnel0( vec3 transmittedIor, float incidentIor ) {

		return square( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );

	}

	// ior is a value between 1.0 and 3.0. 1.0 is air interface
	float iorToFresnel0( float transmittedIor, float incidentIor ) {

		return square( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ) );

	}

	// Fresnel equations for dielectric/dielectric interfaces. See https://belcour.github.io/blog/research/2017/05/01/brdf-thin-film.html
	vec3 evalSensitivity( float OPD, vec3 shift ) {

		float phase = 2.0 * PI * OPD * 1.0e-9;

		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );

		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - square( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * square( phase ) );
		xyz /= 1.0685e-7;

		vec3 srgb = XYZ_TO_REC709 * xyz;
		return srgb;

	}

	// See Section 4. Analytic Spectral Integration, A Practical Extension to Microfacet Theory for the Modeling of Varying Iridescence, https://hal.archives-ouvertes.fr/hal-01518344/document
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {

		vec3 I;

		// Force iridescenceIor -> outsideIOR when thinFilmThickness -> 0.0
		float iridescenceIor = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );

		// Evaluate the cosTheta on the base layer (Snell law)
		float sinTheta2Sq = square( outsideIOR / iridescenceIor ) * ( 1.0 - square( cosTheta1 ) );

		// Handle TIR:
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {

			return vec3( 1.0 );

		}

		float cosTheta2 = sqrt( cosTheta2Sq );

		// First interface
		float R0 = iorToFresnel0( iridescenceIor, outsideIOR );
		float R12 = schlickFresnel( cosTheta1, R0 );
		float R21 = R12;
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIor < outsideIOR ) {

			phi12 = PI;

		}

		float phi21 = PI - phi12;

		// Second interface
		vec3 baseIOR = fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) ); // guard against 1.0
		vec3 R1 = iorToFresnel0( baseIOR, iridescenceIor );
		vec3 R23 = schlickFresnel( cosTheta2, R1 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[0] < iridescenceIor ) {

			phi23[ 0 ] = PI;

		}

		if ( baseIOR[1] < iridescenceIor ) {

			phi23[ 1 ] = PI;

		}

		if ( baseIOR[2] < iridescenceIor ) {

			phi23[ 2 ] = PI;

		}

		// Phase shift
		float OPD = 2.0 * iridescenceIor * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;

		// Compound terms
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = square( T121 ) * R23 / ( vec3( 1.0 ) - R123 );

		// Reflectance term for m = 0 (DC term amplitude)
		vec3 C0 = R12 + Rs;
		I = C0;

		// Reflectance term for m > 0 (pairs of diracs)
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {

			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;

		}

		// Since out of gamut colors might be produced, negative color values are clamped to 0.
		return max( I, vec3( 0.0 ) );

	}

`;

	const sheen_functions = /* glsl */`

	// See equation (2) in http://www.aconty.com/pdf/s2017_pbs_imageworks_sheen.pdf
	float velvetD( float cosThetaH, float roughness ) {

		float alpha = max( roughness, 0.07 );
		alpha = alpha * alpha;

		float invAlpha = 1.0 / alpha;

		float sqrCosThetaH = cosThetaH * cosThetaH;
		float sinThetaH = max( 1.0 - sqrCosThetaH, 0.001 );

		return ( 2.0 + invAlpha ) * pow( sinThetaH, 0.5 * invAlpha ) / ( 2.0 * PI );

	}

	float velvetParamsInterpolate( int i, float oneMinusAlphaSquared ) {

		const float p0[5] = float[5]( 25.3245, 3.32435, 0.16801, -1.27393, -4.85967 );
		const float p1[5] = float[5]( 21.5473, 3.82987, 0.19823, -1.97760, -4.32054 );

		return mix( p1[i], p0[i], oneMinusAlphaSquared );

	}

	float velvetL( float x, float alpha ) {

		float oneMinusAlpha = 1.0 - alpha;
		float oneMinusAlphaSquared = oneMinusAlpha * oneMinusAlpha;

		float a = velvetParamsInterpolate( 0, oneMinusAlphaSquared );
		float b = velvetParamsInterpolate( 1, oneMinusAlphaSquared );
		float c = velvetParamsInterpolate( 2, oneMinusAlphaSquared );
		float d = velvetParamsInterpolate( 3, oneMinusAlphaSquared );
		float e = velvetParamsInterpolate( 4, oneMinusAlphaSquared );

		return a / ( 1.0 + b * pow( abs( x ), c ) ) + d * x + e;

	}

	// See equation (3) in http://www.aconty.com/pdf/s2017_pbs_imageworks_sheen.pdf
	float velvetLambda( float cosTheta, float alpha ) {

		return abs( cosTheta ) < 0.5 ? exp( velvetL( cosTheta, alpha ) ) : exp( 2.0 * velvetL( 0.5, alpha ) - velvetL( 1.0 - cosTheta, alpha ) );

	}

	// See Section 3, Shadowing Term, in http://www.aconty.com/pdf/s2017_pbs_imageworks_sheen.pdf
	float velvetG( float cosThetaO, float cosThetaI, float roughness ) {

		float alpha = max( roughness, 0.07 );
		alpha = alpha * alpha;

		return 1.0 / ( 1.0 + velvetLambda( cosThetaO, alpha ) + velvetLambda( cosThetaI, alpha ) );

	}

	float directionalAlbedoSheen( float cosTheta, float alpha ) {

		cosTheta = saturate( cosTheta );

		float c = 1.0 - cosTheta;
		float c3 = c * c * c;

		return 0.65584461 * c3 + 1.0 / ( 4.16526551 + exp( -7.97291361 * sqrt( alpha ) + 6.33516894 ) );

	}

	float sheenAlbedoScaling( vec3 wo, vec3 wi, SurfaceRecord surf ) {

		float alpha = max( surf.sheenRoughness, 0.07 );
		alpha = alpha * alpha;

		float maxSheenColor = max( max( surf.sheenColor.r, surf.sheenColor.g ), surf.sheenColor.b );

		float eWo = directionalAlbedoSheen( saturateCos( wo.z ), alpha );
		float eWi = directionalAlbedoSheen( saturateCos( wi.z ), alpha );

		return min( 1.0 - maxSheenColor * eWo, 1.0 - maxSheenColor * eWi );

	}

	// See Section 5, Layering, in http://www.aconty.com/pdf/s2017_pbs_imageworks_sheen.pdf
	float sheenAlbedoScaling( vec3 wo, SurfaceRecord surf ) {

		float alpha = max( surf.sheenRoughness, 0.07 );
		alpha = alpha * alpha;

		float maxSheenColor = max( max( surf.sheenColor.r, surf.sheenColor.g ), surf.sheenColor.b );

		float eWo = directionalAlbedoSheen( saturateCos( wo.z ), alpha );

		return 1.0 - maxSheenColor * eWo;

	}

`;

	const inside_fog_volume_function = /* glsl */`

#ifndef FOG_CHECK_ITERATIONS
#define FOG_CHECK_ITERATIONS 30
#endif

// returns whether the given material is a fog material or not
bool isMaterialFogVolume( sampler2D materials, uint materialIndex ) {

	uint i = materialIndex * 45u;
	vec4 s14 = texelFetch1D( materials, i + 14u );
	return bool( int( s14.b ) & 4 );

}

// returns true if we're within the first fog volume we hit
bool bvhIntersectFogVolumeHit(
	vec3 rayOrigin, vec3 rayDirection,
	usampler2D materialIndexAttribute, sampler2D materials,
	inout Material material
) {

	material.fogVolume = false;

	for ( int i = 0; i < FOG_CHECK_ITERATIONS; i ++ ) {

		// find nearest hit
		uvec4 faceIndices = uvec4( 0u );
		vec3 faceNormal = vec3( 0.0, 0.0, 1.0 );
		vec3 barycoord = vec3( 0.0 );
		float side = 1.0;
		float dist = 0.0;
		bool hit = bvhIntersectFirstHit( bvh, rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist );
		if ( hit ) {

			// if it's a fog volume return whether we hit the front or back face
			uint materialIndex = uTexelFetch1D( materialIndexAttribute, faceIndices.x ).r;
			if ( isMaterialFogVolume( materials, materialIndex ) ) {

				material = readMaterialInfo( materials, materialIndex );
				return side == - 1.0;

			} else {

				// move the ray forward
				rayOrigin = stepRayOrigin( rayOrigin, rayDirection, - faceNormal, dist );

			}

		} else {

			return false;

		}

	}

	return false;

}

`;

	const ray_any_hit_function = /* glsl */`

	bool bvhIntersectAnyHit(
		vec3 rayOrigin, vec3 rayDirection,

		// output variables
		inout float side, inout float dist
	) {

		uvec4 faceIndices;
		vec3 faceNormal;
		vec3 barycoord;

		// stack needs to be twice as long as the deepest tree we expect because
		// we push both the left and right child onto the stack every traversal
		int ptr = 0;
		uint stack[ 60 ];
		stack[ 0 ] = 0u;

		float triangleDistance = 1e20;
		while ( ptr > - 1 && ptr < 60 ) {

			uint currNodeIndex = stack[ ptr ];
			ptr --;

			// check if we intersect the current bounds
			float boundsHitDistance = intersectsBVHNodeBounds( rayOrigin, rayDirection, bvh, currNodeIndex );
			if ( boundsHitDistance == INFINITY ) {

				continue;

			}

			uvec2 boundsInfo = uTexelFetch1D( bvh.bvhContents, currNodeIndex ).xy;
			bool isLeaf = bool( boundsInfo.x & 0xffff0000u );

			if ( isLeaf ) {

				uint count = boundsInfo.x & 0x0000ffffu;
				uint offset = boundsInfo.y;

				bool found = intersectTriangles(
					bvh, rayOrigin, rayDirection, offset, count, triangleDistance,
					faceIndices, faceNormal, barycoord, side, dist
				);

				if ( found ) {

					return true;

				}

			} else {

				uint leftIndex = currNodeIndex + 1u;
				uint splitAxis = boundsInfo.x & 0x0000ffffu;
				uint rightIndex = boundsInfo.y;

				// set c2 in the stack so we traverse it later. We need to keep track of a pointer in
				// the stack while we traverse. The second pointer added is the one that will be
				// traversed first
				ptr ++;
				stack[ ptr ] = leftIndex;

				ptr ++;
				stack[ ptr ] = rightIndex;

			}

		}

		return false;

	}

`;

	const attenuate_hit_function = /* glsl */`

	// step through multiple surface hits and accumulate color attenuation based on transmissive surfaces
	// returns true if a solid surface was hit
	bool attenuateHit(
		RenderState state,
		Ray ray, float rayDist,
		out vec3 color
	) {

		// store the original bounce index so we can reset it after
		uint originalBounceIndex = sobolBounceIndex;

		int traversals = state.traversals;
		int transmissiveTraversals = state.transmissiveTraversals;
		bool isShadowRay = state.isShadowRay;
		Material fogMaterial = state.fogMaterial;

		vec3 startPoint = ray.origin;

		// hit results
		SurfaceHit surfaceHit;

		color = vec3( 1.0 );

		bool result = true;
		for ( int i = 0; i < traversals; i ++ ) {

			sobolBounceIndex ++;

			int hitType = traceScene( ray, fogMaterial, surfaceHit );

			if ( hitType == FOG_HIT ) {

				result = true;
				break;

			} else if ( hitType == SURFACE_HIT ) {

				float totalDist = distance( startPoint, ray.origin + ray.direction * surfaceHit.dist );
				if ( totalDist > rayDist ) {

					result = false;
					break;

				}

				// TODO: attenuate the contribution based on the PDF of the resulting ray including refraction values
				// Should be able to work using the material BSDF functions which will take into account specularity, etc.
				// TODO: should we account for emissive surfaces here?

				uint materialIndex = uTexelFetch1D( materialIndexAttribute, surfaceHit.faceIndices.x ).r;
				Material material = readMaterialInfo( materials, materialIndex );

				// adjust the ray to the new surface
				bool isEntering = surfaceHit.side == 1.0;
				ray.origin = stepRayOrigin( ray.origin, ray.direction, - surfaceHit.faceNormal, surfaceHit.dist );

				#if FEATURE_FOG

				if ( material.fogVolume ) {

					fogMaterial = material;
					fogMaterial.fogVolume = surfaceHit.side == 1.0;
					i -= sign( transmissiveTraversals );
					transmissiveTraversals --;
					continue;

				}

				#endif

				if ( ! material.castShadow && isShadowRay ) {

					continue;

				}

				vec2 uv = textureSampleBarycoord( attributesArray, ATTR_UV, surfaceHit.barycoord, surfaceHit.faceIndices.xyz ).xy;
				vec4 vertexColor = textureSampleBarycoord( attributesArray, ATTR_COLOR, surfaceHit.barycoord, surfaceHit.faceIndices.xyz );

				// albedo
				vec4 albedo = vec4( material.color, material.opacity );
				if ( material.map != - 1 ) {

					vec3 uvPrime = material.mapTransform * vec3( uv, 1 );
					albedo *= texture2D( textures, vec3( uvPrime.xy, material.map ) );

				}

				if ( material.vertexColors ) {

					albedo *= vertexColor;

				}

				// alphaMap
				if ( material.alphaMap != - 1 ) {

					albedo.a *= texture2D( textures, vec3( uv, material.alphaMap ) ).x;

				}

				// transmission
				float transmission = material.transmission;
				if ( material.transmissionMap != - 1 ) {

					vec3 uvPrime = material.transmissionMapTransform * vec3( uv, 1 );
					transmission *= texture2D( textures, vec3( uvPrime.xy, material.transmissionMap ) ).r;

				}

				// metalness
				float metalness = material.metalness;
				if ( material.metalnessMap != - 1 ) {

					vec3 uvPrime = material.metalnessMapTransform * vec3( uv, 1 );
					metalness *= texture2D( textures, vec3( uvPrime.xy, material.metalnessMap ) ).b;

				}

				float alphaTest = material.alphaTest;
				bool useAlphaTest = alphaTest != 0.0;
				float transmissionFactor = ( 1.0 - metalness ) * transmission;
				if (
					transmissionFactor < rand( 9 ) && ! (
						// material sidedness
						material.side != 0.0 && surfaceHit.side == material.side

						// alpha test
						|| useAlphaTest && albedo.a < alphaTest

						// opacity
						|| material.transparent && ! useAlphaTest && albedo.a < rand( 10 )
					)
				) {

					result = true;
					break;

				}

				if ( surfaceHit.side == 1.0 && isEntering ) {

					// only attenuate by surface color on the way in
					color *= mix( vec3( 1.0 ), albedo.rgb, transmissionFactor );

				} else if ( surfaceHit.side == - 1.0 ) {

					// attenuate by medium once we hit the opposite side of the model
					color *= transmissionAttenuation( surfaceHit.dist, material.attenuationColor, material.attenuationDistance );

				}

				bool isTransmissiveRay = dot( ray.direction, surfaceHit.faceNormal * surfaceHit.side ) < 0.0;
				if ( ( isTransmissiveRay || isEntering ) && transmissiveTraversals > 0 ) {

					i -= sign( transmissiveTraversals );
					transmissiveTraversals --;

				}

			} else {

				result = false;
				break;

			}

		}

		// reset the bounce index
		sobolBounceIndex = originalBounceIndex;
		return result;

	}

`;

	const camera_util_functions = /* glsl */`

	vec3 ndcToRayOrigin( vec2 coord ) {

		vec4 rayOrigin4 = cameraWorldMatrix * invProjectionMatrix * vec4( coord, - 1.0, 1.0 );
		return rayOrigin4.xyz / rayOrigin4.w;
	}

	Ray getCameraRay() {

		vec2 ssd = vec2( 1.0 ) / resolution;

		// Jitter the camera ray by finding a uv coordinate at a random sample
		// around this pixel's UV coordinate for AA
		vec2 ruv = rand2( 0 );
		vec2 jitteredUv = vUv + vec2( tentFilter( ruv.x ) * ssd.x, tentFilter( ruv.y ) * ssd.y );
		Ray ray;

		#if CAMERA_TYPE == 2

			// Equirectangular projection
			vec4 rayDirection4 = vec4( equirectUvToDirection( jitteredUv ), 0.0 );
			vec4 rayOrigin4 = vec4( 0.0, 0.0, 0.0, 1.0 );

			rayDirection4 = cameraWorldMatrix * rayDirection4;
			rayOrigin4 = cameraWorldMatrix * rayOrigin4;

			ray.direction = normalize( rayDirection4.xyz );
			ray.origin = rayOrigin4.xyz / rayOrigin4.w;

		#else

			// get [- 1, 1] normalized device coordinates
			vec2 ndc = 2.0 * jitteredUv - vec2( 1.0 );
			ray.origin = ndcToRayOrigin( ndc );

			#if CAMERA_TYPE == 1

				// Orthographic projection
				ray.direction = ( cameraWorldMatrix * vec4( 0.0, 0.0, - 1.0, 0.0 ) ).xyz;
				ray.direction = normalize( ray.direction );

			#else

				// Perspective projection
				ray.direction = normalize( mat3( cameraWorldMatrix ) * ( invProjectionMatrix * vec4( ndc, 0.0, 1.0 ) ).xyz );

			#endif

		#endif

		#if FEATURE_DOF
		{

			// depth of field
			vec3 focalPoint = ray.origin + normalize( ray.direction ) * physicalCamera.focusDistance;

			// get the aperture sample
			// if blades === 0 then we assume a circle
			vec3 shapeUVW= rand3( 1 );
			int blades = physicalCamera.apertureBlades;
			float anamorphicRatio = physicalCamera.anamorphicRatio;
			vec2 apertureSample = blades == 0 ? sampleCircle( shapeUVW.xy ) : sampleRegularPolygon( blades, shapeUVW );
			apertureSample *= physicalCamera.bokehSize * 0.5 * 1e-3;

			// rotate the aperture shape
			apertureSample =
				rotateVector( apertureSample, physicalCamera.apertureRotation ) *
				saturate( vec2( anamorphicRatio, 1.0 / anamorphicRatio ) );

			// create the new ray
			ray.origin += ( cameraWorldMatrix * vec4( apertureSample, 0.0, 0.0 ) ).xyz;
			ray.direction = focalPoint - ray.origin;

		}
		#endif

		ray.direction = normalize( ray.direction );

		return ray;

	}

`;

	const direct_light_contribution_function = /*glsl*/`

	vec3 directLightContribution( vec3 worldWo, SurfaceRecord surf, RenderState state, vec3 rayOrigin ) {

		vec3 result = vec3( 0.0 );

		// uniformly pick a light or environment map
		if( lightsDenom != 0.0 && rand( 5 ) < float( lights.count ) / lightsDenom ) {

			// sample a light or environment
			LightRecord lightRec = randomLightSample( lights.tex, iesProfiles, lights.count, rayOrigin, rand3( 6 ) );

			bool isSampleBelowSurface = ! surf.volumeParticle && dot( surf.faceNormal, lightRec.direction ) < 0.0;
			if ( isSampleBelowSurface ) {

				lightRec.pdf = 0.0;

			}

			// check if a ray could even reach the light area
			Ray lightRay;
			lightRay.origin = rayOrigin;
			lightRay.direction = lightRec.direction;
			vec3 attenuatedColor;
			if (
				lightRec.pdf > 0.0 &&
				isDirectionValid( lightRec.direction, surf.normal, surf.faceNormal ) &&
				! attenuateHit( state, lightRay, lightRec.dist, attenuatedColor )
			) {

				// get the material pdf
				vec3 sampleColor;
				float lightMaterialPdf = bsdfResult( worldWo, lightRec.direction, surf, sampleColor );
				bool isValidSampleColor = all( greaterThanEqual( sampleColor, vec3( 0.0 ) ) );
				if ( lightMaterialPdf > 0.0 && isValidSampleColor ) {

					// weight the direct light contribution
					float lightPdf = lightRec.pdf / lightsDenom;
					float misWeight = lightRec.type == SPOT_LIGHT_TYPE || lightRec.type == DIR_LIGHT_TYPE || lightRec.type == POINT_LIGHT_TYPE ? 1.0 : misHeuristic( lightPdf, lightMaterialPdf );
					result = attenuatedColor * lightRec.emission * state.throughputColor * sampleColor * misWeight / lightPdf;

				}

			}

		} else if ( envMapInfo.totalSum != 0.0 && environmentIntensity != 0.0 ) {

			// find a sample in the environment map to include in the contribution
			vec3 envColor, envDirection;
			float envPdf = sampleEquirectProbability( rand2( 7 ), envColor, envDirection );
			envDirection = invEnvRotation3x3 * envDirection;

			// this env sampling is not set up for transmissive sampling and yields overly bright
			// results so we ignore the sample in this case.
			// TODO: this should be improved but how? The env samples could traverse a few layers?
			bool isSampleBelowSurface = ! surf.volumeParticle && dot( surf.faceNormal, envDirection ) < 0.0;
			if ( isSampleBelowSurface ) {

				envPdf = 0.0;

			}

			// check if a ray could even reach the surface
			Ray envRay;
			envRay.origin = rayOrigin;
			envRay.direction = envDirection;
			vec3 attenuatedColor;
			if (
				envPdf > 0.0 &&
				isDirectionValid( envDirection, surf.normal, surf.faceNormal ) &&
				! attenuateHit( state, envRay, INFINITY, attenuatedColor )
			) {

				// get the material pdf
				vec3 sampleColor;
				float envMaterialPdf = bsdfResult( worldWo, envDirection, surf, sampleColor );
				bool isValidSampleColor = all( greaterThanEqual( sampleColor, vec3( 0.0 ) ) );
				if ( envMaterialPdf > 0.0 && isValidSampleColor ) {

					// weight the direct light contribution
					envPdf /= lightsDenom;
					float misWeight = misHeuristic( envPdf, envMaterialPdf );
					result = attenuatedColor * environmentIntensity * envColor * state.throughputColor * sampleColor * misWeight / envPdf;

				}

			}

		}

		// Function changed to have a single return statement to potentially help with crashes on Mac OS.
		// See issue #470
		return result;

	}

`;

	const get_surface_record_function = /* glsl */`

	#define SKIP_SURFACE 0
	#define HIT_SURFACE 1
	int getSurfaceRecord(
		Material material, SurfaceHit surfaceHit, sampler2DArray attributesArray,
		float accumulatedRoughness,
		inout SurfaceRecord surf
	) {

		if ( material.fogVolume ) {

			vec3 normal = vec3( 0, 0, 1 );

			SurfaceRecord fogSurface;
			fogSurface.volumeParticle = true;
			fogSurface.color = material.color;
			fogSurface.emission = material.emissiveIntensity * material.emissive;
			fogSurface.normal = normal;
			fogSurface.faceNormal = normal;
			fogSurface.clearcoatNormal = normal;

			surf = fogSurface;
			return HIT_SURFACE;

		}

		// uv coord for textures
		vec2 uv = textureSampleBarycoord( attributesArray, ATTR_UV, surfaceHit.barycoord, surfaceHit.faceIndices.xyz ).xy;
		vec4 vertexColor = textureSampleBarycoord( attributesArray, ATTR_COLOR, surfaceHit.barycoord, surfaceHit.faceIndices.xyz );

		// albedo
		vec4 albedo = vec4( material.color, material.opacity );
		if ( material.map != - 1 ) {

			vec3 uvPrime = material.mapTransform * vec3( uv, 1 );
			albedo *= texture2D( textures, vec3( uvPrime.xy, material.map ) );

		}

		if ( material.vertexColors ) {

			albedo *= vertexColor;

		}

		// alphaMap
		if ( material.alphaMap != - 1 ) {

			albedo.a *= texture2D( textures, vec3( uv, material.alphaMap ) ).x;

		}

		// possibly skip this sample if it's transparent, alpha test is enabled, or we hit the wrong material side
		// and it's single sided.
		// - alpha test is disabled when it === 0
		// - the material sidedness test is complicated because we want light to pass through the back side but still
		// be able to see the front side. This boolean checks if the side we hit is the front side on the first ray
		// and we're rendering the other then we skip it. Do the opposite on subsequent bounces to get incoming light.
		float alphaTest = material.alphaTest;
		bool useAlphaTest = alphaTest != 0.0;
		if (
			// material sidedness
			material.side != 0.0 && surfaceHit.side != material.side

			// alpha test
			|| useAlphaTest && albedo.a < alphaTest

			// opacity
			|| material.transparent && ! useAlphaTest && albedo.a < rand( 3 )
		) {

			return SKIP_SURFACE;

		}

		// fetch the interpolated smooth normal
		vec3 normal = normalize( textureSampleBarycoord(
			attributesArray,
			ATTR_NORMAL,
			surfaceHit.barycoord,
			surfaceHit.faceIndices.xyz
		).xyz );

		// roughness
		float roughness = material.roughness;
		if ( material.roughnessMap != - 1 ) {

			vec3 uvPrime = material.roughnessMapTransform * vec3( uv, 1 );
			roughness *= texture2D( textures, vec3( uvPrime.xy, material.roughnessMap ) ).g;

		}

		// metalness
		float metalness = material.metalness;
		if ( material.metalnessMap != - 1 ) {

			vec3 uvPrime = material.metalnessMapTransform * vec3( uv, 1 );
			metalness *= texture2D( textures, vec3( uvPrime.xy, material.metalnessMap ) ).b;

		}

		// emission
		vec3 emission = material.emissiveIntensity * material.emissive;
		if ( material.emissiveMap != - 1 ) {

			vec3 uvPrime = material.emissiveMapTransform * vec3( uv, 1 );
			emission *= texture2D( textures, vec3( uvPrime.xy, material.emissiveMap ) ).xyz;

		}

		// transmission
		float transmission = material.transmission;
		if ( material.transmissionMap != - 1 ) {

			vec3 uvPrime = material.transmissionMapTransform * vec3( uv, 1 );
			transmission *= texture2D( textures, vec3( uvPrime.xy, material.transmissionMap ) ).r;

		}

		// normal
		if ( material.flatShading ) {

			// if we're rendering a flat shaded object then use the face normals - the face normal
			// is provided based on the side the ray hits the mesh so flip it to align with the
			// interpolated vertex normals.
			normal = surfaceHit.faceNormal * surfaceHit.side;

		}

		vec3 baseNormal = normal;
		if ( material.normalMap != - 1 ) {

			vec4 tangentSample = textureSampleBarycoord(
				attributesArray,
				ATTR_TANGENT,
				surfaceHit.barycoord,
				surfaceHit.faceIndices.xyz
			);

			// some provided tangents can be malformed (0, 0, 0) causing the normal to be degenerate
			// resulting in NaNs and slow path tracing.
			if ( length( tangentSample.xyz ) > 0.0 ) {

				vec3 tangent = normalize( tangentSample.xyz );
				vec3 bitangent = normalize( cross( normal, tangent ) * tangentSample.w );
				mat3 vTBN = mat3( tangent, bitangent, normal );

				vec3 uvPrime = material.normalMapTransform * vec3( uv, 1 );
				vec3 texNormal = texture2D( textures, vec3( uvPrime.xy, material.normalMap ) ).xyz * 2.0 - 1.0;
				texNormal.xy *= material.normalScale;
				normal = vTBN * texNormal;

			}

		}

		normal *= surfaceHit.side;

		// clearcoat
		float clearcoat = material.clearcoat;
		if ( material.clearcoatMap != - 1 ) {

			vec3 uvPrime = material.clearcoatMapTransform * vec3( uv, 1 );
			clearcoat *= texture2D( textures, vec3( uvPrime.xy, material.clearcoatMap ) ).r;

		}

		// clearcoatRoughness
		float clearcoatRoughness = material.clearcoatRoughness;
		if ( material.clearcoatRoughnessMap != - 1 ) {

			vec3 uvPrime = material.clearcoatRoughnessMapTransform * vec3( uv, 1 );
			clearcoatRoughness *= texture2D( textures, vec3( uvPrime.xy, material.clearcoatRoughnessMap ) ).g;

		}

		// clearcoatNormal
		vec3 clearcoatNormal = baseNormal;
		if ( material.clearcoatNormalMap != - 1 ) {

			vec4 tangentSample = textureSampleBarycoord(
				attributesArray,
				ATTR_TANGENT,
				surfaceHit.barycoord,
				surfaceHit.faceIndices.xyz
			);

			// some provided tangents can be malformed (0, 0, 0) causing the normal to be degenerate
			// resulting in NaNs and slow path tracing.
			if ( length( tangentSample.xyz ) > 0.0 ) {

				vec3 tangent = normalize( tangentSample.xyz );
				vec3 bitangent = normalize( cross( clearcoatNormal, tangent ) * tangentSample.w );
				mat3 vTBN = mat3( tangent, bitangent, clearcoatNormal );

				vec3 uvPrime = material.clearcoatNormalMapTransform * vec3( uv, 1 );
				vec3 texNormal = texture2D( textures, vec3( uvPrime.xy, material.clearcoatNormalMap ) ).xyz * 2.0 - 1.0;
				texNormal.xy *= material.clearcoatNormalScale;
				clearcoatNormal = vTBN * texNormal;

			}

		}

		clearcoatNormal *= surfaceHit.side;

		// sheenColor
		vec3 sheenColor = material.sheenColor;
		if ( material.sheenColorMap != - 1 ) {

			vec3 uvPrime = material.sheenColorMapTransform * vec3( uv, 1 );
			sheenColor *= texture2D( textures, vec3( uvPrime.xy, material.sheenColorMap ) ).rgb;

		}

		// sheenRoughness
		float sheenRoughness = material.sheenRoughness;
		if ( material.sheenRoughnessMap != - 1 ) {

			vec3 uvPrime = material.sheenRoughnessMapTransform * vec3( uv, 1 );
			sheenRoughness *= texture2D( textures, vec3( uvPrime.xy, material.sheenRoughnessMap ) ).a;

		}

		// iridescence
		float iridescence = material.iridescence;
		if ( material.iridescenceMap != - 1 ) {

			vec3 uvPrime = material.iridescenceMapTransform * vec3( uv, 1 );
			iridescence *= texture2D( textures, vec3( uvPrime.xy, material.iridescenceMap ) ).r;

		}

		// iridescence thickness
		float iridescenceThickness = material.iridescenceThicknessMaximum;
		if ( material.iridescenceThicknessMap != - 1 ) {

			vec3 uvPrime = material.iridescenceThicknessMapTransform * vec3( uv, 1 );
			float iridescenceThicknessSampled = texture2D( textures, vec3( uvPrime.xy, material.iridescenceThicknessMap ) ).g;
			iridescenceThickness = mix( material.iridescenceThicknessMinimum, material.iridescenceThicknessMaximum, iridescenceThicknessSampled );

		}

		iridescence = iridescenceThickness == 0.0 ? 0.0 : iridescence;

		// specular color
		vec3 specularColor = material.specularColor;
		if ( material.specularColorMap != - 1 ) {

			vec3 uvPrime = material.specularColorMapTransform * vec3( uv, 1 );
			specularColor *= texture2D( textures, vec3( uvPrime.xy, material.specularColorMap ) ).rgb;

		}

		// specular intensity
		float specularIntensity = material.specularIntensity;
		if ( material.specularIntensityMap != - 1 ) {

			vec3 uvPrime = material.specularIntensityMapTransform * vec3( uv, 1 );
			specularIntensity *= texture2D( textures, vec3( uvPrime.xy, material.specularIntensityMap ) ).a;

		}

		surf.volumeParticle = false;

		surf.faceNormal = surfaceHit.faceNormal;
		surf.normal = normal;

		surf.metalness = metalness;
		surf.color = albedo.rgb;
		surf.emission = emission;

		surf.ior = material.ior;
		surf.transmission = transmission;
		surf.thinFilm = material.thinFilm;
		surf.attenuationColor = material.attenuationColor;
		surf.attenuationDistance = material.attenuationDistance;

		surf.clearcoatNormal = clearcoatNormal;
		surf.clearcoat = clearcoat;

		surf.sheen = material.sheen;
		surf.sheenColor = sheenColor;

		surf.iridescence = iridescence;
		surf.iridescenceIor = material.iridescenceIor;
		surf.iridescenceThickness = iridescenceThickness;

		surf.specularColor = specularColor;
		surf.specularIntensity = specularIntensity;

		// apply perceptual roughness factor from gltf. sheen perceptual roughness is
		// applied by its brdf function
		// https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#microfacet-surfaces
		surf.roughness = roughness * roughness;
		surf.clearcoatRoughness = clearcoatRoughness * clearcoatRoughness;
		surf.sheenRoughness = sheenRoughness;

		// frontFace is used to determine transmissive properties and PDF. If no transmission is used
		// then we can just always assume this is a front face.
		surf.frontFace = surfaceHit.side == 1.0 || transmission == 0.0;
		surf.eta = material.thinFilm || surf.frontFace ? 1.0 / material.ior : material.ior;
		surf.f0 = iorRatioToF0( surf.eta );

		// Compute the filtered roughness value to use during specular reflection computations.
		// The accumulated roughness value is scaled by a user setting and a "magic value" of 5.0.
		// If we're exiting something transmissive then scale the factor down significantly so we can retain
		// sharp internal reflections
		surf.filteredRoughness = applyFilteredGlossy( surf.roughness, accumulatedRoughness );
		surf.filteredClearcoatRoughness = applyFilteredGlossy( surf.clearcoatRoughness, accumulatedRoughness );

		// get the normal frames
		surf.normalBasis = getBasisFromNormal( surf.normal );
		surf.normalInvBasis = inverse( surf.normalBasis );

		surf.clearcoatBasis = getBasisFromNormal( surf.clearcoatNormal );
		surf.clearcoatInvBasis = inverse( surf.clearcoatBasis );

		return HIT_SURFACE;

	}
`;

	const render_structs = /* glsl */`

	struct Ray {

		vec3 origin;
		vec3 direction;

	};

	struct SurfaceHit {

		uvec4 faceIndices;
		vec3 barycoord;
		vec3 faceNormal;
		float side;
		float dist;

	};

	struct RenderState {

		bool firstRay;
		bool transmissiveRay;
		bool isShadowRay;
		float accumulatedRoughness;
		int transmissiveTraversals;
		int traversals;
		uint depth;
		vec3 throughputColor;
		Material fogMaterial;

	};

	RenderState initRenderState() {

		RenderState result;
		result.firstRay = true;
		result.transmissiveRay = true;
		result.isShadowRay = false;
		result.accumulatedRoughness = 0.0;
		result.transmissiveTraversals = 0;
		result.traversals = 0;
		result.throughputColor = vec3( 1.0 );
		result.depth = 0u;
		result.fogMaterial.fogVolume = false;
		return result;

	}

`;

	const trace_scene_function = /* glsl */`

	#define NO_HIT 0
	#define SURFACE_HIT 1
	#define LIGHT_HIT 2
	#define FOG_HIT 3

	// Passing the global variable 'lights' into this function caused shader program errors.
	// So global variables like 'lights' and 'bvh' were moved out of the function parameters.
	// For more information, refer to: https://github.com/gkjohnson/three-gpu-pathtracer/pull/457
	int traceScene(
		Ray ray, Material fogMaterial, inout SurfaceHit surfaceHit
	) {

		int result = NO_HIT;
		bool hit = bvhIntersectFirstHit( bvh, ray.origin, ray.direction, surfaceHit.faceIndices, surfaceHit.faceNormal, surfaceHit.barycoord, surfaceHit.side, surfaceHit.dist );

		#if FEATURE_FOG

		if ( fogMaterial.fogVolume ) {

			// offset the distance so we don't run into issues with particles on the same surface
			// as other objects
			float particleDist = intersectFogVolume( fogMaterial, rand( 1 ) );
			if ( particleDist + RAY_OFFSET < surfaceHit.dist ) {

				surfaceHit.side = 1.0;
				surfaceHit.faceNormal = normalize( - ray.direction );
				surfaceHit.dist = particleDist;
				return FOG_HIT;

			}

		}

		#endif

		if ( hit ) {

			result = SURFACE_HIT;

		}

		return result;

	}

`;

	class PhysicalPathTracingMaterial extends MaterialBase {

		onBeforeRender() {

			this.setDefine( 'FEATURE_DOF', this.physicalCamera.bokehSize === 0 ? 0 : 1 );
			this.setDefine( 'FEATURE_BACKGROUND_MAP', this.backgroundMap ? 1 : 0 );
			this.setDefine( 'FEATURE_FOG', this.materials.features.isUsed( 'FOG' ) ? 1 : 0 );

		}

		constructor( parameters ) {

			super( {

				transparent: true,
				depthWrite: false,

				defines: {
					FEATURE_MIS: 1,
					FEATURE_RUSSIAN_ROULETTE: 1,
					FEATURE_DOF: 1,
					FEATURE_BACKGROUND_MAP: 0,
					FEATURE_FOG: 1,

					// 0 = PCG
					// 1 = Sobol
					// 2 = Stratified List
					RANDOM_TYPE: 2,

					// 0 = Perspective
					// 1 = Orthographic
					// 2 = Equirectangular
					CAMERA_TYPE: 0,

					DEBUG_MODE: 0,

					ATTR_NORMAL: 0,
					ATTR_TANGENT: 1,
					ATTR_UV: 2,
					ATTR_COLOR: 3,
				},

				uniforms: {

					// path trace uniforms
					resolution: { value: new three.Vector2() },
					opacity: { value: 1 },
					bounces: { value: 10 },
					transmissiveBounces: { value: 10 },
					filterGlossyFactor: { value: 0 },

					// camera uniforms
					physicalCamera: { value: new PhysicalCameraUniform() },
					cameraWorldMatrix: { value: new three.Matrix4() },
					invProjectionMatrix: { value: new three.Matrix4() },

					// scene uniforms
					bvh: { value: new threeMeshBvh.MeshBVHUniformStruct() },
					attributesArray: { value: new AttributesTextureArray() },
					materialIndexAttribute: { value: new threeMeshBvh.UIntVertexAttributeTexture() },
					materials: { value: new MaterialsTexture() },
					textures: { value: new RenderTarget2DArray().texture },

					// light uniforms
					lights: { value: new LightsInfoUniformStruct() },
					iesProfiles: { value: new RenderTarget2DArray( 360, 180, {
						type: three.HalfFloatType,
						wrapS: three.ClampToEdgeWrapping,
						wrapT: three.ClampToEdgeWrapping,
					} ).texture },
					environmentIntensity: { value: 1.0 },
					environmentRotation: { value: new three.Matrix4() },
					envMapInfo: { value: new EquirectHdrInfoUniform() },

					// background uniforms
					backgroundBlur: { value: 0.0 },
					backgroundMap: { value: null },
					backgroundAlpha: { value: 1.0 },
					backgroundIntensity: { value: 1.0 },
					backgroundRotation: { value: new three.Matrix4() },

					// randomness uniforms
					seed: { value: 0 },
					sobolTexture: { value: null },
					stratifiedTexture: { value: new StratifiedSamplesTexture() },
					stratifiedOffsetTexture: { value: new BlueNoiseTexture( 64, 1 ) },
				},

				vertexShader: /* glsl */`

				varying vec2 vUv;
				void main() {

					vec4 mvPosition = vec4( position, 1.0 );
					mvPosition = modelViewMatrix * mvPosition;
					gl_Position = projectionMatrix * mvPosition;

					vUv = uv;

				}

			`,

				fragmentShader: /* glsl */`
				#define RAY_OFFSET 1e-4
				#define INFINITY 1e20

				precision highp isampler2D;
				precision highp usampler2D;
				precision highp sampler2DArray;
				vec4 envMapTexelToLinear( vec4 a ) { return a; }
				#include <common>

				// bvh intersection
				${ threeMeshBvh.BVHShaderGLSL.common_functions }
				${ threeMeshBvh.BVHShaderGLSL.bvh_struct_definitions }
				${ threeMeshBvh.BVHShaderGLSL.bvh_ray_functions }

				// uniform structs
				${ camera_struct }
				${ lights_struct }
				${ equirect_struct }
				${ material_struct }
				${ surface_record_struct }

				// random
				#if RANDOM_TYPE == 2 	// Stratified List

					${ stratified_functions }

				#elif RANDOM_TYPE == 1 	// Sobol

					${ pcg_functions }
					${ sobol_common }
					${ sobol_functions }

					#define rand(v) sobol(v)
					#define rand2(v) sobol2(v)
					#define rand3(v) sobol3(v)
					#define rand4(v) sobol4(v)

				#else 					// PCG

				${ pcg_functions }

					// Using the sobol functions seems to break the the compiler on MacOS
					// - specifically the "sobolReverseBits" function.
					uint sobolPixelIndex = 0u;
					uint sobolPathIndex = 0u;
					uint sobolBounceIndex = 0u;

					#define rand(v) pcgRand()
					#define rand2(v) pcgRand2()
					#define rand3(v) pcgRand3()
					#define rand4(v) pcgRand4()

				#endif

				// common
				${ texture_sample_functions }
				${ fresnel_functions }
				${ util_functions }
				${ math_functions }
				${ shape_intersection_functions }

				// environment
				uniform EquirectHdrInfo envMapInfo;
				uniform mat4 environmentRotation;
				uniform float environmentIntensity;

				// lighting
				uniform sampler2DArray iesProfiles;
				uniform LightsInfo lights;

				// background
				uniform float backgroundBlur;
				uniform float backgroundAlpha;
				#if FEATURE_BACKGROUND_MAP

				uniform sampler2D backgroundMap;
				uniform mat4 backgroundRotation;
				uniform float backgroundIntensity;

				#endif

				// camera
				uniform mat4 cameraWorldMatrix;
				uniform mat4 invProjectionMatrix;
				#if FEATURE_DOF

				uniform PhysicalCamera physicalCamera;

				#endif

				// geometry
				uniform sampler2DArray attributesArray;
				uniform usampler2D materialIndexAttribute;
				uniform sampler2D materials;
				uniform sampler2DArray textures;
				uniform BVH bvh;

				// path tracer
				uniform int bounces;
				uniform int transmissiveBounces;
				uniform float filterGlossyFactor;
				uniform int seed;

				// image
				uniform vec2 resolution;
				uniform float opacity;

				varying vec2 vUv;

				// globals
				mat3 envRotation3x3;
				mat3 invEnvRotation3x3;
				float lightsDenom;

				// sampling
				${ shape_sampling_functions }
				${ equirect_functions }
				${ light_sampling_functions }

				${ inside_fog_volume_function }
				${ ggx_functions }
				${ sheen_functions }
				${ iridescence_functions }
				${ fog_functions }
				${ bsdf_functions }

				float applyFilteredGlossy( float roughness, float accumulatedRoughness ) {

					return clamp(
						max(
							roughness,
							accumulatedRoughness * filterGlossyFactor * 5.0 ),
						0.0,
						1.0
					);

				}

				vec3 sampleBackground( vec3 direction, vec2 uv ) {

					vec3 sampleDir = sampleHemisphere( direction, uv ) * 0.5 * backgroundBlur;

					#if FEATURE_BACKGROUND_MAP

					sampleDir = normalize( mat3( backgroundRotation ) * direction + sampleDir );
					return backgroundIntensity * sampleEquirectColor( backgroundMap, sampleDir );

					#else

					sampleDir = normalize( envRotation3x3 * direction + sampleDir );
					return environmentIntensity * sampleEquirectColor( envMapInfo.map, sampleDir );

					#endif

				}

				${ render_structs }
				${ camera_util_functions }
				${ trace_scene_function }
				${ attenuate_hit_function }
				${ direct_light_contribution_function }
				${ get_surface_record_function }

				void main() {

					// init
					rng_initialize( gl_FragCoord.xy, seed );
					sobolPixelIndex = ( uint( gl_FragCoord.x ) << 16 ) | uint( gl_FragCoord.y );
					sobolPathIndex = uint( seed );

					// get camera ray
					Ray ray = getCameraRay();

					// inverse environment rotation
					envRotation3x3 = mat3( environmentRotation );
					invEnvRotation3x3 = inverse( envRotation3x3 );
					lightsDenom =
						( environmentIntensity == 0.0 || envMapInfo.totalSum == 0.0 ) && lights.count != 0u ?
							float( lights.count ) :
							float( lights.count + 1u );

					// final color
					gl_FragColor = vec4( 0, 0, 0, 1 );

					// surface results
					SurfaceHit surfaceHit;
					ScatterRecord scatterRec;

					// path tracing state
					RenderState state = initRenderState();
					state.transmissiveTraversals = transmissiveBounces;
					#if FEATURE_FOG

					state.fogMaterial.fogVolume = bvhIntersectFogVolumeHit(
						ray.origin, - ray.direction,
						materialIndexAttribute, materials,
						state.fogMaterial
					);

					#endif

					for ( int i = 0; i < bounces; i ++ ) {

						sobolBounceIndex ++;

						state.depth ++;
						state.traversals = bounces - i;
						state.firstRay = i == 0 && state.transmissiveTraversals == transmissiveBounces;

						int hitType = traceScene( ray, state.fogMaterial, surfaceHit );

						// check if we intersect any lights and accumulate the light contribution
						// TODO: we can add support for light surface rendering in the else condition if we
						// add the ability to toggle visibility of the the light
						if ( ! state.firstRay && ! state.transmissiveRay ) {

							LightRecord lightRec;
							float lightDist = hitType == NO_HIT ? INFINITY : surfaceHit.dist;
							for ( uint i = 0u; i < lights.count; i ++ ) {

								if (
									intersectLightAtIndex( lights.tex, ray.origin, ray.direction, i, lightRec ) &&
									lightRec.dist < lightDist
								) {

									#if FEATURE_MIS

									// weight the contribution
									// NOTE: Only area lights are supported for forward sampling and can be hit
									float misWeight = misHeuristic( scatterRec.pdf, lightRec.pdf / lightsDenom );
									gl_FragColor.rgb += lightRec.emission * state.throughputColor * misWeight;

									#else

									gl_FragColor.rgb += lightRec.emission * state.throughputColor;

									#endif

								}

							}

						}

						if ( hitType == NO_HIT ) {

							if ( state.firstRay || state.transmissiveRay ) {

								gl_FragColor.rgb += sampleBackground( ray.direction, rand2( 2 ) ) * state.throughputColor;
								gl_FragColor.a = backgroundAlpha;

							} else {

								#if FEATURE_MIS

								// get the PDF of the hit envmap point
								vec3 envColor;
								float envPdf = sampleEquirect( envRotation3x3 * ray.direction, envColor );
								envPdf /= lightsDenom;

								// and weight the contribution
								float misWeight = misHeuristic( scatterRec.pdf, envPdf );
								gl_FragColor.rgb += environmentIntensity * envColor * state.throughputColor * misWeight;

								#else

								gl_FragColor.rgb +=
									environmentIntensity *
									sampleEquirectColor( envMapInfo.map, envRotation3x3 * ray.direction ) *
									state.throughputColor;

								#endif

							}
							break;

						}

						uint materialIndex = uTexelFetch1D( materialIndexAttribute, surfaceHit.faceIndices.x ).r;
						Material material = readMaterialInfo( materials, materialIndex );

						#if FEATURE_FOG

						if ( hitType == FOG_HIT ) {

							material = state.fogMaterial;
							state.accumulatedRoughness += 0.2;

						} else if ( material.fogVolume ) {

							state.fogMaterial = material;
							state.fogMaterial.fogVolume = surfaceHit.side == 1.0;

							ray.origin = stepRayOrigin( ray.origin, ray.direction, - surfaceHit.faceNormal, surfaceHit.dist );

							i -= sign( state.transmissiveTraversals );
							state.transmissiveTraversals -= sign( state.transmissiveTraversals );
							continue;

						}

						#endif

						// early out if this is a matte material
						if ( material.matte && state.firstRay ) {

							gl_FragColor = vec4( 0.0 );
							break;

						}

						// if we've determined that this is a shadow ray and we've hit an item with no shadow casting
						// then skip it
						if ( ! material.castShadow && state.isShadowRay ) {

							ray.origin = stepRayOrigin( ray.origin, ray.direction, - surfaceHit.faceNormal, surfaceHit.dist );
							continue;

						}

						SurfaceRecord surf;
						if (
							getSurfaceRecord(
								material, surfaceHit, attributesArray, state.accumulatedRoughness,
								surf
							) == SKIP_SURFACE
						) {

							// only allow a limited number of transparency discards otherwise we could
							// crash the context with too long a loop.
							i -= sign( state.transmissiveTraversals );
							state.transmissiveTraversals -= sign( state.transmissiveTraversals );

							ray.origin = stepRayOrigin( ray.origin, ray.direction, - surfaceHit.faceNormal, surfaceHit.dist );
							continue;

						}

						scatterRec = bsdfSample( - ray.direction, surf );
						state.isShadowRay = scatterRec.specularPdf < rand( 4 );

						bool isBelowSurface = ! surf.volumeParticle && dot( scatterRec.direction, surf.faceNormal ) < 0.0;
						vec3 hitPoint = stepRayOrigin( ray.origin, ray.direction, isBelowSurface ? - surf.faceNormal : surf.faceNormal, surfaceHit.dist );

						// next event estimation
						#if FEATURE_MIS

						gl_FragColor.rgb += directLightContribution( - ray.direction, surf, state, hitPoint );

						#endif

						// accumulate a roughness value to offset diffuse, specular, diffuse rays that have high contribution
						// to a single pixel resulting in fireflies
						// TODO: handle transmissive surfaces
						if ( ! surf.volumeParticle && ! isBelowSurface ) {

							// determine if this is a rough normal or not by checking how far off straight up it is
							vec3 halfVector = normalize( - ray.direction + scatterRec.direction );
							state.accumulatedRoughness += max(
								sin( acosApprox( dot( halfVector, surf.normal ) ) ),
								sin( acosApprox( dot( halfVector, surf.clearcoatNormal ) ) )
							);

							state.transmissiveRay = false;

						}

						// accumulate emissive color
						gl_FragColor.rgb += ( surf.emission * state.throughputColor );

						// skip the sample if our PDF or ray is impossible
						if ( scatterRec.pdf <= 0.0 || ! isDirectionValid( scatterRec.direction, surf.normal, surf.faceNormal ) ) {

							break;

						}

						// if we're bouncing around the inside a transmissive material then decrement
						// perform this separate from a bounce
						bool isTransmissiveRay = ! surf.volumeParticle && dot( scatterRec.direction, surf.faceNormal * surfaceHit.side ) < 0.0;
						if ( ( isTransmissiveRay || isBelowSurface ) && state.transmissiveTraversals > 0 ) {

							state.transmissiveTraversals --;
							i --;

						}

						//

						// handle throughput color transformation
						// attenuate the throughput color by the medium color
						if ( ! surf.frontFace ) {

							state.throughputColor *= transmissionAttenuation( surfaceHit.dist, surf.attenuationColor, surf.attenuationDistance );

						}

						#if FEATURE_RUSSIAN_ROULETTE

						// russian roulette path termination
						// https://www.arnoldrenderer.com/research/physically_based_shader_design_in_arnold.pdf
						uint minBounces = 3u;
						float depthProb = float( state.depth < minBounces );

						float rrProb = luminance( state.throughputColor * scatterRec.color / scatterRec.pdf );
						rrProb /= luminance( state.throughputColor );
						rrProb = sqrt( rrProb );
						rrProb = max( rrProb, depthProb );
						rrProb = min( rrProb, 1.0 );
						if ( rand( 8 ) > rrProb ) {

							break;

						}

						// perform sample clamping here to avoid bright pixels
						state.throughputColor *= min( 1.0 / rrProb, 20.0 );

						#endif

						// adjust the throughput and discard and exit if we find discard the sample if there are any NaNs
						state.throughputColor *= scatterRec.color / scatterRec.pdf;
						if ( any( isnan( state.throughputColor ) ) || any( isinf( state.throughputColor ) ) ) {

							break;

						}

						//

						// prepare for next ray
						ray.direction = scatterRec.direction;
						ray.origin = hitPoint;

					}

					gl_FragColor.a *= opacity;

					#if DEBUG_MODE == 1

					// output the number of rays checked in the path and number of
					// transmissive rays encountered.
					gl_FragColor.rgb = vec3(
						float( state.depth ),
						transmissiveBounces - state.transmissiveTraversals,
						0.0
					);
					gl_FragColor.a = 1.0;

					#endif

				}

			`

			} );

			this.setValues( parameters );

		}

	}

	function* renderTask() {

		const {
			_renderer,
			_fsQuad,
			_blendQuad,
			_primaryTarget,
			_blendTargets,
			_sobolTarget,
			_subframe,
			alpha,
			material,
		} = this;
		const _ogScissor = new three.Vector4();
		const _ogViewport = new three.Vector4();

		const blendMaterial = _blendQuad.material;
		let [ blendTarget1, blendTarget2 ] = _blendTargets;

		while ( true ) {

			if ( alpha ) {

				blendMaterial.opacity = this._opacityFactor / ( this.samples + 1 );
				material.blending = three.NoBlending;
				material.opacity = 1;

			} else {

				material.opacity = this._opacityFactor / ( this.samples + 1 );
				material.blending = three.NormalBlending;

			}

			const [ subX, subY, subW, subH ] = _subframe;

			const w = _primaryTarget.width;
			const h = _primaryTarget.height;
			material.resolution.set( w * subW, h * subH );
			material.sobolTexture = _sobolTarget.texture;
			material.stratifiedTexture.init( 20, material.bounces + material.transmissiveBounces + 5 );
			material.stratifiedTexture.next();
			material.seed ++;

			const tilesX = this.tiles.x || 1;
			const tilesY = this.tiles.y || 1;
			const totalTiles = tilesX * tilesY;

			const pxSubW = Math.ceil( w * subW );
			const pxSubH = Math.ceil( h * subH );
			const pxSubX = Math.floor( subX * w );
			const pxSubY = Math.floor( subY * h );

			const pxTileW = Math.ceil( pxSubW / tilesX );
			const pxTileH = Math.ceil( pxSubH / tilesY );

			for ( let y = 0; y < tilesY; y ++ ) {

				for ( let x = 0; x < tilesX; x ++ ) {

					// store og state
					const ogRenderTarget = _renderer.getRenderTarget();
					const ogAutoClear = _renderer.autoClear;
					const ogScissorTest = _renderer.getScissorTest();
					_renderer.getScissor( _ogScissor );
					_renderer.getViewport( _ogViewport );

					let tx = x;
					let ty = y;
					if ( ! this.stableTiles ) {

						const tileIndex = ( this._currentTile ) % ( tilesX * tilesY );
						tx = tileIndex % tilesX;
						ty = ~ ~ ( tileIndex / tilesX );

						this._currentTile = tileIndex + 1;

					}

					// set the scissor and the viewport on the render target
					// note that when using the webgl renderer set viewport the device pixel ratio
					// is multiplied into the field causing some pixels to not be rendered
					const reverseTy = tilesY - ty - 1;
					_primaryTarget.scissor.set(
						pxSubX + tx * pxTileW,
						pxSubY + reverseTy * pxTileH,
						Math.min( pxTileW, pxSubW - tx * pxTileW ),
						Math.min( pxTileH, pxSubH - reverseTy * pxTileH ),
					);

					_primaryTarget.viewport.set(
						pxSubX,
						pxSubY,
						pxSubW,
						pxSubH,
					);

					// three.js renderer takes values relative to the current pixel ratio
					_renderer.setRenderTarget( _primaryTarget );
					_renderer.setScissorTest( true );

					_renderer.autoClear = false;
					_fsQuad.render( _renderer );

					// reset original renderer state
					_renderer.setViewport( _ogViewport );
					_renderer.setScissor( _ogScissor );
					_renderer.setScissorTest( ogScissorTest );
					_renderer.setRenderTarget( ogRenderTarget );
					_renderer.autoClear = ogAutoClear;

					// swap and blend alpha targets
					if ( alpha ) {

						blendMaterial.target1 = blendTarget1.texture;
						blendMaterial.target2 = _primaryTarget.texture;

						_renderer.setRenderTarget( blendTarget2 );
						_blendQuad.render( _renderer );
						_renderer.setRenderTarget( ogRenderTarget );

					}

					this.samples += ( 1 / totalTiles );

					// round the samples value if we've finished the tiles
					if ( x === tilesX - 1 && y === tilesY - 1 ) {

						this.samples = Math.round( this.samples );

					}

					yield;

				}

			}

			[ blendTarget1, blendTarget2 ] = [ blendTarget2, blendTarget1 ];

		}

	}

	const ogClearColor = new three.Color();
	class PathTracingRenderer {

		get material() {

			return this._fsQuad.material;

		}

		set material( v ) {

			this._fsQuad.material.removeEventListener( 'recompilation', this._compileFunction );
			v.addEventListener( 'recompilation', this._compileFunction );

			this._fsQuad.material = v;

		}

		get target() {

			return this._alpha ? this._blendTargets[ 1 ] : this._primaryTarget;

		}

		set alpha( v ) {

			if ( this._alpha === v ) {

				return;

			}

			if ( ! v ) {

				this._blendTargets[ 0 ].dispose();
				this._blendTargets[ 1 ].dispose();

			}

			this._alpha = v;
			this.reset();

		}

		get alpha() {

			return this._alpha;

		}

		get isCompiling() {

			return Boolean( this._compilePromise );

		}

		constructor( renderer ) {

			this.camera = null;
			this.tiles = new three.Vector2( 3, 3 );

			this.stableNoise = false;
			this.stableTiles = true;

			this.samples = 0;
			this._subframe = new three.Vector4( 0, 0, 1, 1 );
			this._opacityFactor = 1.0;
			this._renderer = renderer;
			this._alpha = false;
			this._fsQuad = new Pass_js.FullScreenQuad( new PhysicalPathTracingMaterial() );
			this._blendQuad = new Pass_js.FullScreenQuad( new BlendMaterial() );
			this._task = null;
			this._currentTile = 0;
			this._compilePromise = null;

			this._sobolTarget = new SobolNumberMapGenerator().generate( renderer );

			this._primaryTarget = new three.WebGLRenderTarget( 1, 1, {
				format: three.RGBAFormat,
				type: three.FloatType,
				magFilter: three.NearestFilter,
				minFilter: three.NearestFilter,
			} );
			this._blendTargets = [
				new three.WebGLRenderTarget( 1, 1, {
					format: three.RGBAFormat,
					type: three.FloatType,
					magFilter: three.NearestFilter,
					minFilter: three.NearestFilter,
				} ),
				new three.WebGLRenderTarget( 1, 1, {
					format: three.RGBAFormat,
					type: three.FloatType,
					magFilter: three.NearestFilter,
					minFilter: three.NearestFilter,
				} ),
			];

			// function for listening to for triggered compilation so we can wait for compilation to finish
			// before starting to render
			this._compileFunction = () => {

				const promise = this.compileMaterial( this._fsQuad._mesh );
				promise.then( () => {

					if ( this._compilePromise === promise ) {

						this._compilePromise = null;

					}

				} );

				this._compilePromise = promise;

			};

			this.material.addEventListener( 'recompilation', this._compileFunction );

		}

		compileMaterial() {

			return this._renderer.compileAsync( this._fsQuad._mesh );

		}

		setCamera( camera ) {

			const { material } = this;
			material.cameraWorldMatrix.copy( camera.matrixWorld );
			material.invProjectionMatrix.copy( camera.projectionMatrixInverse );
			material.physicalCamera.updateFrom( camera );

			// Perspective camera (default)
			let cameraType = 0;

			// An orthographic projection matrix will always have the bottom right element == 1
			// And a perspective projection matrix will always have the bottom right element == 0
			if ( camera.projectionMatrix.elements[ 15 ] > 0 ) {

				// Orthographic
				cameraType = 1;

			}

			if ( camera.isEquirectCamera ) {

				// Equirectangular
				cameraType = 2;

			}

			material.setDefine( 'CAMERA_TYPE', cameraType );

			this.camera = camera;

		}

		setSize( w, h ) {

			w = Math.ceil( w );
			h = Math.ceil( h );

			if ( this._primaryTarget.width === w && this._primaryTarget.height === h ) {

				return;

			}

			this._primaryTarget.setSize( w, h );
			this._blendTargets[ 0 ].setSize( w, h );
			this._blendTargets[ 1 ].setSize( w, h );
			this.reset();

		}

		getSize( target ) {

			target.x = this._primaryTarget.width;
			target.y = this._primaryTarget.height;

		}

		dispose() {

			this._primaryTarget.dispose();
			this._blendTargets[ 0 ].dispose();
			this._blendTargets[ 1 ].dispose();
			this._sobolTarget.dispose();

			this._fsQuad.dispose();
			this._blendQuad.dispose();
			this._task = null;

		}

		reset() {

			const { _renderer, _primaryTarget, _blendTargets } = this;
			const ogRenderTarget = _renderer.getRenderTarget();
			const ogClearAlpha = _renderer.getClearAlpha();
			_renderer.getClearColor( ogClearColor );

			_renderer.setRenderTarget( _primaryTarget );
			_renderer.setClearColor( 0, 0 );
			_renderer.clearColor();

			_renderer.setRenderTarget( _blendTargets[ 0 ] );
			_renderer.setClearColor( 0, 0 );
			_renderer.clearColor();

			_renderer.setRenderTarget( _blendTargets[ 1 ] );
			_renderer.setClearColor( 0, 0 );
			_renderer.clearColor();

			_renderer.setClearColor( ogClearColor, ogClearAlpha );
			_renderer.setRenderTarget( ogRenderTarget );

			this.samples = 0;
			this._task = null;

			this.material.stratifiedTexture.stableNoise = this.stableNoise;
			if ( this.stableNoise ) {

				this.material.seed = 0;
				this.material.stratifiedTexture.reset();

			}

		}

		update() {

			// ensure we've updated our defines before rendering so we can ensure we
			// can wait for compilation to finish
			this.material.onBeforeRender();
			if ( this.isCompiling ) {

				return;

			}

			if ( ! this._task ) {

				this._task = renderTask.call( this );

			}

			this._task.next();

		}

	}

	const _uv = new three.Vector2();
	const _coord = new three.Vector2();
	const _polar = new three.Spherical();
	const _color = new three.Color();
	class ProceduralEquirectTexture extends three.DataTexture {

		constructor( width = 512, height = 512 ) {

			super(
				new Float32Array( width * height * 4 ),
				width, height, three.RGBAFormat, three.FloatType, three.EquirectangularReflectionMapping,
				three.RepeatWrapping, three.ClampToEdgeWrapping, three.LinearFilter, three.LinearFilter,
			);

			this.generationCallback = null;

		}

		update() {

			this.dispose();
			this.needsUpdate = true;

			const { data, width, height } = this.image;
			for ( let x = 0; x < width; x ++ ) {

				for ( let y = 0; y < height; y ++ ) {

					_coord.set( width, height );

					_uv.set( x / width, y / height );
					_uv.x -= 0.5;
					_uv.y = 1.0 - _uv.y;

					_polar.theta = _uv.x * 2.0 * Math.PI;
					_polar.phi = _uv.y * Math.PI;
					_polar.radius = 1.0;

					this.generationCallback( _polar, _uv, _coord, _color );

					const i = y * width + x;
					const i4 = 4 * i;
					data[ i4 + 0 ] = ( _color.r );
					data[ i4 + 1 ] = ( _color.g );
					data[ i4 + 2 ] = ( _color.b );
					data[ i4 + 3 ] = ( 1.0 );

				}

			}

		}

		copy( other ) {

			super.copy( other );
			this.generationCallback = other.generationCallback;
			return this;

		}

	}

	const _direction = new three.Vector3();
	class GradientEquirectTexture extends ProceduralEquirectTexture {

		constructor( resolution = 512 ) {

			super( resolution, resolution );

			this.topColor = new three.Color().set( 0xffffff );
			this.bottomColor = new three.Color().set( 0x000000 );
			this.exponent = 2;
			this.generationCallback = ( polar, uv, coord, color ) => {

				_direction.setFromSpherical( polar );

				const t = _direction.y * 0.5 + 0.5;
				color.lerpColors( this.bottomColor, this.topColor, t ** this.exponent );

			};

		}

		copy( other ) {

			super.copy( other );

			this.topColor.copy( other.topColor );
			this.bottomColor.copy( other.bottomColor );
			return this;

		}

	}

	// Material that tone maps a texture before performing interpolation to prevent
	// unexpected high values during texture stretching interpolation.
	// Emulates browser image stretching
	class ClampedInterpolationMaterial extends three.ShaderMaterial {

		get map() {

			return this.uniforms.map.value;

		}

		set map( v ) {

			this.uniforms.map.value = v;

		}

		get opacity() {

			return this.uniforms.opacity.value;

		}

		set opacity( v ) {

			if ( this.uniforms ) {

				this.uniforms.opacity.value = v;

			}

		}

		constructor( params ) {

			super( {
				uniforms: {

					map: { value: null },
					opacity: { value: 1 },

				},

				vertexShader: /* glsl */`
				varying vec2 vUv;
				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}
			`,

				fragmentShader: /* glsl */`
				uniform sampler2D map;
				uniform float opacity;
				varying vec2 vUv;

				vec4 clampedTexelFatch( sampler2D map, ivec2 px, int lod ) {

					vec4 res = texelFetch( map, ivec2( px.x, px.y ), 0 );

					#if defined( TONE_MAPPING )

					res.xyz = toneMapping( res.xyz );

					#endif

			  		return linearToOutputTexel( res );

				}

				void main() {

					vec2 size = vec2( textureSize( map, 0 ) );
					vec2 pxUv = vUv * size;
					vec2 pxCurr = floor( pxUv );
					vec2 pxFrac = fract( pxUv ) - 0.5;
					vec2 pxOffset;
					pxOffset.x = pxFrac.x > 0.0 ? 1.0 : - 1.0;
					pxOffset.y = pxFrac.y > 0.0 ? 1.0 : - 1.0;

					vec2 pxNext = clamp( pxOffset + pxCurr, vec2( 0.0 ), size - 1.0 );
					vec2 alpha = abs( pxFrac );

					vec4 p1 = mix(
						clampedTexelFatch( map, ivec2( pxCurr.x, pxCurr.y ), 0 ),
						clampedTexelFatch( map, ivec2( pxNext.x, pxCurr.y ), 0 ),
						alpha.x
					);

					vec4 p2 = mix(
						clampedTexelFatch( map, ivec2( pxCurr.x, pxNext.y ), 0 ),
						clampedTexelFatch( map, ivec2( pxNext.x, pxNext.y ), 0 ),
						alpha.x
					);

					gl_FragColor = mix( p1, p2, alpha.y );
					gl_FragColor.a *= opacity;
					#include <premultiplied_alpha_fragment>

				}
			`
			} );

			this.setValues( params );

		}

	}

	class CubeToEquirectMaterial extends three.ShaderMaterial {

		constructor() {

			super( {

				uniforms: {

					envMap: { value: null },
					flipEnvMap: { value: - 1 },

				},

				vertexShader: /* glsl */`
				varying vec2 vUv;
				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,

				fragmentShader: /* glsl */`
				#define ENVMAP_TYPE_CUBE_UV

				uniform samplerCube envMap;
				uniform float flipEnvMap;
				varying vec2 vUv;

				#include <common>
				#include <cube_uv_reflection_fragment>

				${ util_functions }

				void main() {

					vec3 rayDirection = equirectUvToDirection( vUv );
					rayDirection.x *= flipEnvMap;
					gl_FragColor = textureCube( envMap, rayDirection );

				}`
			} );

			this.depthWrite = false;
			this.depthTest = false;

		}

	}

	class CubeToEquirectGenerator {

		constructor( renderer ) {

			this._renderer = renderer;
			this._quad = new Pass_js.FullScreenQuad( new CubeToEquirectMaterial() );

		}

		generate( source, width = null, height = null ) {

			if ( ! source.isCubeTexture ) {

				throw new Error( 'CubeToEquirectMaterial: Source can only be cube textures.' );

			}

			const image = source.images[ 0 ];
			const renderer = this._renderer;
			const quad = this._quad;

			// determine the dimensions if not provided
			if ( width === null ) {

				width = 4 * image.height;

			}

			if ( height === null ) {

				height = 2 * image.height;

			}

			const target = new three.WebGLRenderTarget( width, height, {
				type: three.FloatType,
				colorSpace: image.colorSpace,
			} );

			// prep the cube map data
			const imageHeight = image.height;
			const maxMip = Math.log2( imageHeight ) - 2;
			const texelHeight = 1.0 / imageHeight;
			const texelWidth = 1.0 / ( 3 * Math.max( Math.pow( 2, maxMip ), 7 * 16 ) );

			quad.material.defines.CUBEUV_MAX_MIP = `${ maxMip }.0`;
			quad.material.defines.CUBEUV_TEXEL_WIDTH = texelWidth;
			quad.material.defines.CUBEUV_TEXEL_HEIGHT = texelHeight;
			quad.material.uniforms.envMap.value = source;
			quad.material.uniforms.flipEnvMap.value = source.isRenderTargetTexture ? 1 : - 1;
			quad.material.needsUpdate = true;

			// save state and render the contents
			const currentTarget = renderer.getRenderTarget();
			const currentAutoClear = renderer.autoClear;
			renderer.autoClear = true;
			renderer.setRenderTarget( target );
			quad.render( renderer );
			renderer.setRenderTarget( currentTarget );
			renderer.autoClear = currentAutoClear;

			// read the data back
			const buffer = new Uint16Array( width * height * 4 );
			const readBuffer = new Float32Array( width * height * 4 );
			renderer.readRenderTargetPixels( target, 0, 0, width, height, readBuffer );
			target.dispose();

			for ( let i = 0, l = readBuffer.length; i < l; i ++ ) {

				buffer[ i ] = three.DataUtils.toHalfFloat( readBuffer[ i ] );

			}

			// produce the data texture
			const result = new three.DataTexture( buffer, width, height, three.RGBAFormat, three.HalfFloatType );
			result.minFilter = three.LinearMipMapLinearFilter;
			result.magFilter = three.LinearFilter;
			result.wrapS = three.RepeatWrapping;
			result.wrapT = three.RepeatWrapping;
			result.mapping = three.EquirectangularReflectionMapping;
			result.needsUpdate = true;

			return result;

		}

		dispose() {

			this._quad.dispose();

		}

	}

	function supportsFloatBlending( renderer ) {

		return renderer.extensions.get( 'EXT_float_blend' );

	}

	const _resolution = new three.Vector2();
	class WebGLPathTracer {

		get multipleImportanceSampling() {

			return Boolean( this._pathTracer.material.defines.FEATURE_MIS );

		}

		set multipleImportanceSampling( v ) {

			this._pathTracer.material.setDefine( 'FEATURE_MIS', v ? 1 : 0 );

		}

		get transmissiveBounces() {

			return this._pathTracer.material.transmissiveBounces;

		}

		set transmissiveBounces( v ) {

			this._pathTracer.material.transmissiveBounces = v;

		}

		get bounces() {

			return this._pathTracer.material.bounces;

		}

		set bounces( v ) {

			this._pathTracer.material.bounces = v;

		}

		get filterGlossyFactor() {

			return this._pathTracer.material.filterGlossyFactor;

		}

		set filterGlossyFactor( v ) {

			this._pathTracer.material.filterGlossyFactor = v;

		}

		get samples() {

			return this._pathTracer.samples;

		}

		get target() {

			return this._pathTracer.target;

		}

		get tiles() {

			return this._pathTracer.tiles;

		}

		get stableNoise() {

			return this._pathTracer.stableNoise;

		}

		set stableNoise( v ) {

			this._pathTracer.stableNoise = v;

		}

		get isCompiling() {

			return Boolean( this._pathTracer.isCompiling );

		}

		constructor( renderer ) {

			// members
			this._renderer = renderer;
			this._generator = new PathTracingSceneGenerator();
			this._pathTracer = new PathTracingRenderer( renderer );
			this._queueReset = false;
			this._clock = new three.Clock();
			this._compilePromise = null;

			this._lowResPathTracer = new PathTracingRenderer( renderer );
			this._lowResPathTracer.tiles.set( 1, 1 );
			this._quad = new Pass_js.FullScreenQuad( new ClampedInterpolationMaterial( {
				map: null,
				transparent: true,
				blending: three.NoBlending,

				premultipliedAlpha: renderer.getContextAttributes().premultipliedAlpha,
			} ) );
			this._materials = null;

			this._previousEnvironment = null;
			this._previousBackground = null;
			this._internalBackground = null;

			// options
			this.renderDelay = 100;
			this.minSamples = 5;
			this.fadeDuration = 500;
			this.enablePathTracing = true;
			this.pausePathTracing = false;
			this.dynamicLowRes = false;
			this.lowResScale = 0.25;
			this.renderScale = 1;
			this.synchronizeRenderSize = true;
			this.rasterizeScene = true;
			this.renderToCanvas = true;
			this.textureSize = new three.Vector2( 1024, 1024 );
			this.rasterizeSceneCallback = ( scene, camera ) => {

				this._renderer.render( scene, camera );

			};

			this.renderToCanvasCallback = ( target, renderer, quad ) => {

				const currentAutoClear = renderer.autoClear;
				renderer.autoClear = false;
				quad.render( renderer );
				renderer.autoClear = currentAutoClear;

			};

			// initialize the scene so it doesn't fail
			this.setScene( new three.Scene(), new three.PerspectiveCamera() );

		}

		setBVHWorker( worker ) {

			this._generator.setBVHWorker( worker );

		}

		setScene( scene, camera, options = {} ) {

			scene.updateMatrixWorld( true );
			camera.updateMatrixWorld();

			const generator = this._generator;
			generator.setObjects( scene );

			if ( this._buildAsync ) {

				return generator.generateAsync( options.onProgress ).then( result => {

					return this._updateFromResults( scene, camera, result );

				} );

			} else {

				const result = generator.generate();
				return this._updateFromResults( scene, camera, result );

			}

		}

		setSceneAsync( ...args ) {

			this._buildAsync = true;
			const result = this.setScene( ...args );
			this._buildAsync = false;

			return result;

		}

		setCamera( camera ) {

			this.camera = camera;
			this.updateCamera();

		}

		updateCamera() {

			const camera = this.camera;
			camera.updateMatrixWorld();

			this._pathTracer.setCamera( camera );
			this._lowResPathTracer.setCamera( camera );
			this.reset();

		}

		updateMaterials() {

			const material = this._pathTracer.material;
			const renderer = this._renderer;
			const materials = this._materials;
			const textureSize = this.textureSize;

			// reduce texture sources here - we don't want to do this in the
			// textures array because we need to pass the textures array into the
			// material target
			const textures = getTextures( materials );
			material.textures.setTextures( renderer, textures, textureSize.x, textureSize.y );
			material.materials.updateFrom( materials, textures );
			this.reset();

		}

		updateLights() {

			const scene = this.scene;
			const renderer = this._renderer;
			const material = this._pathTracer.material;

			const lights = getLights( scene );
			const iesTextures = getIesTextures( lights );
			material.lights.updateFrom( lights, iesTextures );
			material.iesProfiles.setTextures( renderer, iesTextures );
			this.reset();

		}

		updateEnvironment() {

			const scene = this.scene;
			const material = this._pathTracer.material;

			if ( this._internalBackground ) {

				this._internalBackground.dispose();
				this._internalBackground = null;

			}

			// update scene background
			material.backgroundBlur = scene.backgroundBlurriness;
			material.backgroundIntensity = scene.backgroundIntensity ?? 1;
			material.backgroundRotation.makeRotationFromEuler( scene.backgroundRotation ).invert();
			if ( scene.background === null ) {

				material.backgroundMap = null;
				material.backgroundAlpha = 0;

			} else if ( scene.background.isColor ) {

				this._colorBackground = this._colorBackground || new GradientEquirectTexture( 16 );

				const colorBackground = this._colorBackground;
				if ( ! colorBackground.topColor.equals( scene.background ) ) {

					// set the texture color
					colorBackground.topColor.set( scene.background );
					colorBackground.bottomColor.set( scene.background );
					colorBackground.update();

				}

				// assign to material
				material.backgroundMap = colorBackground;
				material.backgroundAlpha = 1;

			} else if ( scene.background.isCubeTexture ) {

				if ( scene.background !== this._previousBackground ) {

					const background = new CubeToEquirectGenerator( this._renderer ).generate( scene.background );
					this._internalBackground = background;
					material.backgroundMap = background;
					material.backgroundAlpha = 1;

				}

			} else {

				material.backgroundMap = scene.background;
				material.backgroundAlpha = 1;

			}

			// update scene environment
			material.environmentIntensity = scene.environmentIntensity ?? 1;
			material.environmentRotation.makeRotationFromEuler( scene.environmentRotation ).invert();
			if ( this._previousEnvironment !== scene.environment ) {

				if ( scene.environment !== null ) {

					if ( scene.environment.isCubeTexture ) {

						const environment = new CubeToEquirectGenerator( this._renderer ).generate( scene.environment );
						material.envMapInfo.updateFrom( environment );

					} else {

						// TODO: Consider setting this to the highest supported bit depth by checking for
						// OES_texture_float_linear or OES_texture_half_float_linear. Requires changes to
						// the equirect uniform
						material.envMapInfo.updateFrom( scene.environment );

					}

				} else {

					material.environmentIntensity = 0;

				}

			}

			this._previousEnvironment = scene.environment;
			this._previousBackground = scene.background;
			this.reset();

		}

		_updateFromResults( scene, camera, results ) {

			const {
				materials,
				geometry,
				bvh,
				bvhChanged,
			} = results;

			this._materials = materials;

			const pathTracer = this._pathTracer;
			const material = pathTracer.material;

			if ( bvhChanged ) {

				material.bvh.updateFrom( bvh );
				material.attributesArray.updateFrom(
					geometry.attributes.normal,
					geometry.attributes.tangent,
					geometry.attributes.uv,
					geometry.attributes.color,
				);

				material.materialIndexAttribute.updateFrom( geometry.attributes.materialIndex );

			}

			// save previously used items
			this._previousScene = scene;
			this.scene = scene;
			this.camera = camera;

			this.updateCamera();
			this.updateMaterials();
			this.updateEnvironment();
			this.updateLights();

			return results;

		}

		renderSample() {

			const lowResPathTracer = this._lowResPathTracer;
			const pathTracer = this._pathTracer;
			const renderer = this._renderer;
			const clock = this._clock;
			const quad = this._quad;

			this._updateScale();

			if ( this._queueReset ) {

				pathTracer.reset();
				lowResPathTracer.reset();
				this._queueReset = false;

				quad.material.opacity = 0;
				clock.start();

			}

			// render the path tracing sample after enough time has passed
			const delta = clock.getDelta() * 1e3;
			const elapsedTime = clock.getElapsedTime() * 1e3;
			if ( ! this.pausePathTracing && this.enablePathTracing && this.renderDelay <= elapsedTime && ! this.isCompiling ) {

				pathTracer.update();

			}

			// when alpha is enabled we use a manual blending system rather than
			// rendering with a blend function
			pathTracer.alpha = pathTracer.material.backgroundAlpha !== 1 || ! supportsFloatBlending( renderer );
			lowResPathTracer.alpha = pathTracer.alpha;

			if ( this.renderToCanvas ) {

				const renderer = this._renderer;
				const minSamples = this.minSamples;

				if ( elapsedTime >= this.renderDelay && this.samples >= this.minSamples ) {

					if ( this.fadeDuration !== 0 ) {

						quad.material.opacity = Math.min( quad.material.opacity + delta / this.fadeDuration, 1 );

					} else {

						quad.material.opacity = 1;

					}

				}

				// render the fallback if we haven't rendered enough samples, are paused, or are occluded
				if ( ! this.enablePathTracing || this.samples < minSamples || quad.material.opacity < 1 ) {

					if ( this.dynamicLowRes && ! this.isCompiling ) {

						if ( lowResPathTracer.samples < 1 ) {

							lowResPathTracer.material = pathTracer.material;
							lowResPathTracer.update();

						}

						const currentOpacity = quad.material.opacity;
						quad.material.opacity = 1 - quad.material.opacity;
						quad.material.map = lowResPathTracer.target.texture;
						quad.render( renderer );
						quad.material.opacity = currentOpacity;

					}

					if ( ! this.dynamicLowRes && this.rasterizeScene || this.dynamicLowRes && this.isCompiling ) {

						this.rasterizeSceneCallback( this.scene, this.camera );

					}

				}


				if ( this.enablePathTracing && quad.material.opacity > 0 ) {

					if ( quad.material.opacity < 1 ) {

						// use additive blending when the low res texture is rendered so we can fade the
						// background out while the full res fades in
						quad.material.blending = this.dynamicLowRes ? three.AdditiveBlending : three.NormalBlending;

					}

					quad.material.map = pathTracer.target.texture;
					this.renderToCanvasCallback( pathTracer.target, renderer, quad );
					quad.material.blending = three.NoBlending;

				}

			}

		}

		reset() {

			this._queueReset = true;
			this._pathTracer.samples = 0;

		}

		dispose() {

			this._renderQuad.dispose();
			this._renderQuad.material.dispose();
			this._pathTracer.dispose();

		}

		_updateScale() {

			// update the path tracer scale if it has changed
			if ( this.synchronizeRenderSize ) {

				this._renderer.getDrawingBufferSize( _resolution );

				const w = Math.floor( this.renderScale * _resolution.x );
				const h = Math.floor( this.renderScale * _resolution.y );

				this._pathTracer.getSize( _resolution );
				if ( _resolution.x !== w || _resolution.y !== h ) {

					const lowResScale = this.lowResScale;
					this._pathTracer.setSize( w, h );
					this._lowResPathTracer.setSize( Math.floor( w * lowResScale ), Math.floor( h * lowResScale ) );

				}

			}

		}

	}

	class EquirectCamera extends three.Camera {

		constructor() {

			super();

			this.isEquirectCamera = true;

		}

	}

	class PhysicalSpotLight extends three.SpotLight {

		constructor( ...args ) {

			super( ...args );

			this.iesMap = null;
			this.radius = 0;

		}

		copy( source, recursive ) {

			super.copy( source, recursive );

			this.iesMap = source.iesMap;
			this.radius = source.radius;

			return this;

		}

	}

	class ShapedAreaLight extends three.RectAreaLight {

		constructor( ...args ) {

			super( ...args );
			this.isCircular = false;

		}

		copy( source, recursive ) {

			super.copy( source, recursive );

			this.isCircular = source.isCircular;

			return this;

		}

	}

	class PMREMCopyMaterial extends MaterialBase {

		constructor() {

			super( {

				uniforms: {

					envMap: { value: null },
					blur: { value: 0 },

				},

				vertexShader: /* glsl */`

				varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}

			`,

				fragmentShader: /* glsl */`

				#include <common>
				#include <cube_uv_reflection_fragment>

				${ util_functions }

				uniform sampler2D envMap;
				uniform float blur;
				varying vec2 vUv;
				void main() {

					vec3 rayDirection = equirectUvToDirection( vUv );
					gl_FragColor = textureCubeUV( envMap, rayDirection, blur );

				}

			`,

			} );

		}

	}

	class BlurredEnvMapGenerator {

		constructor( renderer ) {

			this.renderer = renderer;
			this.pmremGenerator = new three.PMREMGenerator( renderer );
			this.copyQuad = new Pass_js.FullScreenQuad( new PMREMCopyMaterial() );
			this.renderTarget = new three.WebGLRenderTarget( 1, 1, { type: three.FloatType, format: three.RGBAFormat } );

		}

		dispose() {

			this.pmremGenerator.dispose();
			this.copyQuad.dispose();
			this.renderTarget.dispose();

		}

		generate( texture, blur ) {

			const { pmremGenerator, renderTarget, copyQuad, renderer } = this;

			// get the pmrem target
			const pmremTarget = pmremGenerator.fromEquirectangular( texture );

			// set up the material
			const { width, height } = texture.image;
			renderTarget.setSize( width, height );
			copyQuad.material.envMap = pmremTarget.texture;
			copyQuad.material.blur = blur;

			// render
			const prevRenderTarget = renderer.getRenderTarget();
			const prevClear = renderer.autoClear;

			renderer.setRenderTarget( renderTarget );
			renderer.autoClear = true;
			copyQuad.render( renderer );

			renderer.setRenderTarget( prevRenderTarget );
			renderer.autoClear = prevClear;

			// read the data back
			const buffer = new Uint16Array( width * height * 4 );
			const readBuffer = new Float32Array( width * height * 4 );
			renderer.readRenderTargetPixels( renderTarget, 0, 0, width, height, readBuffer );

			for ( let i = 0, l = readBuffer.length; i < l; i ++ ) {

				buffer[ i ] = three.DataUtils.toHalfFloat( readBuffer[ i ] );

			}

			const result = new three.DataTexture( buffer, width, height, three.RGBAFormat, three.HalfFloatType );
			result.minFilter = texture.minFilter;
			result.magFilter = texture.magFilter;
			result.wrapS = texture.wrapS;
			result.wrapT = texture.wrapT;
			result.mapping = three.EquirectangularReflectionMapping;
			result.needsUpdate = true;

			// dispose of the now unneeded target
			pmremTarget.dispose();

			return result;

		}

	}

	class DenoiseMaterial extends MaterialBase {

		constructor( parameters ) {

			super( {

				blending: three.NoBlending,

				transparent: false,

				depthWrite: false,

				depthTest: false,

				defines: {

					USE_SLIDER: 0,

				},

				uniforms: {

					sigma: { value: 5.0 },
					threshold: { value: 0.03 },
					kSigma: { value: 1.0 },

					map: { value: null },
					opacity: { value: 1 },

				},

				vertexShader: /* glsl */`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}

			`,

				fragmentShader: /* glsl */`

				//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
				//  Copyright (c) 2018-2019 Michele Morrone
				//  All rights reserved.
				//
				//  https://michelemorrone.eu - https://BrutPitt.com
				//
				//  me@michelemorrone.eu - brutpitt@gmail.com
				//  twitter: @BrutPitt - github: BrutPitt
				//
				//  https://github.com/BrutPitt/glslSmartDeNoise/
				//
				//  This software is distributed under the terms of the BSD 2-Clause license
				//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

				uniform sampler2D map;

				uniform float sigma;
				uniform float threshold;
				uniform float kSigma;
				uniform float opacity;

				varying vec2 vUv;

				#define INV_SQRT_OF_2PI 0.39894228040143267793994605993439
				#define INV_PI 0.31830988618379067153776752674503

				// Parameters:
				//	 sampler2D tex	 - sampler image / texture
				//	 vec2 uv		   - actual fragment coord
				//	 float sigma  >  0 - sigma Standard Deviation
				//	 float kSigma >= 0 - sigma coefficient
				//		 kSigma * sigma  -->  radius of the circular kernel
				//	 float threshold   - edge sharpening threshold
				vec4 smartDeNoise( sampler2D tex, vec2 uv, float sigma, float kSigma, float threshold ) {

					float radius = round( kSigma * sigma );
					float radQ = radius * radius;

					float invSigmaQx2 = 0.5 / ( sigma * sigma );
					float invSigmaQx2PI = INV_PI * invSigmaQx2;

					float invThresholdSqx2 = 0.5 / ( threshold * threshold );
					float invThresholdSqrt2PI = INV_SQRT_OF_2PI / threshold;

					vec4 centrPx = texture2D( tex, uv );
					centrPx.rgb *= centrPx.a;

					float zBuff = 0.0;
					vec4 aBuff = vec4( 0.0 );
					vec2 size = vec2( textureSize( tex, 0 ) );

					vec2 d;
					for ( d.x = - radius; d.x <= radius; d.x ++ ) {

						float pt = sqrt( radQ - d.x * d.x );

						for ( d.y = - pt; d.y <= pt; d.y ++ ) {

							float blurFactor = exp( - dot( d, d ) * invSigmaQx2 ) * invSigmaQx2PI;

							vec4 walkPx = texture2D( tex, uv + d / size );
							walkPx.rgb *= walkPx.a;

							vec4 dC = walkPx - centrPx;
							float deltaFactor = exp( - dot( dC.rgba, dC.rgba ) * invThresholdSqx2 ) * invThresholdSqrt2PI * blurFactor;

							zBuff += deltaFactor;
							aBuff += deltaFactor * walkPx;

						}

					}

					return aBuff / zBuff;

				}

				void main() {

					gl_FragColor = smartDeNoise( map, vec2( vUv.x, vUv.y ), sigma, kSigma, threshold );
					#include <tonemapping_fragment>
					#include <colorspace_fragment>
					#include <premultiplied_alpha_fragment>

					gl_FragColor.a *= opacity;

				}

			`

			} );

			this.setValues( parameters );

		}

	}

	class FogVolumeMaterial extends three.MeshStandardMaterial {

		constructor( params ) {

			super( params );

			this.isFogVolumeMaterial = true;

			this.density = 0.015;
			this.emissive = new three.Color();
			this.emissiveIntensity = 0.0;
			this.opacity = 0.15;
			this.transparent = true;
			this.roughness = 1.0;
			this.metalness = 0.0;

			this.setValues( params );

		}

	}

	// core

	exports.BlurredEnvMapGenerator = BlurredEnvMapGenerator;
	exports.DenoiseMaterial = DenoiseMaterial;
	exports.DynamicPathTracingSceneGenerator = DynamicPathTracingSceneGenerator;
	exports.EquirectCamera = EquirectCamera;
	exports.FogVolumeMaterial = FogVolumeMaterial;
	exports.GradientEquirectTexture = GradientEquirectTexture;
	exports.PathTracingRenderer = PathTracingRenderer;
	exports.PathTracingSceneGenerator = PathTracingSceneGenerator;
	exports.PathTracingSceneWorker = PathTracingSceneWorker;
	exports.PhysicalCamera = PhysicalCamera;
	exports.PhysicalPathTracingMaterial = PhysicalPathTracingMaterial;
	exports.PhysicalSpotLight = PhysicalSpotLight;
	exports.ProceduralEquirectTexture = ProceduralEquirectTexture;
	exports.ShapedAreaLight = ShapedAreaLight;
	exports.WebGLPathTracer = WebGLPathTracer;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=index.umd.cjs.map
