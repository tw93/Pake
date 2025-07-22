import { BufferAttribute, Vector3, Vector2, Plane, Line3, Triangle, Sphere, Matrix4, Box3, BackSide, DoubleSide, FrontSide, Object3D, BufferGeometry, Group, LineBasicMaterial, MeshBasicMaterial, Ray, Mesh, RGBAFormat, RGFormat, RedFormat, RGBAIntegerFormat, RGIntegerFormat, RedIntegerFormat, DataTexture, NearestFilter, IntType, UnsignedIntType, FloatType, UnsignedByteType, UnsignedShortType, ByteType, ShortType, Vector4, Matrix3 } from 'three';

// Split strategy constants
const CENTER = 0;
const AVERAGE = 1;
const SAH = 2;

// Traversal constants
const NOT_INTERSECTED = 0;
const INTERSECTED = 1;
const CONTAINED = 2;

// SAH cost constants
// TODO: hone these costs more. The relative difference between them should be the
// difference in measured time to perform a triangle intersection vs traversing
// bounds.
const TRIANGLE_INTERSECT_COST = 1.25;
const TRAVERSAL_COST = 1;


// Build constants
const BYTES_PER_NODE = 6 * 4 + 4 + 4;
const IS_LEAFNODE_FLAG = 0xFFFF;

// EPSILON for computing floating point error during build
// https://en.wikipedia.org/wiki/Machine_epsilon#Values_for_standard_hardware_floating_point_arithmetics
const FLOAT32_EPSILON = Math.pow( 2, - 24 );

const SKIP_GENERATION = Symbol( 'SKIP_GENERATION' );

function getVertexCount( geo ) {

	return geo.index ? geo.index.count : geo.attributes.position.count;

}

function getTriCount( geo ) {

	return getVertexCount( geo ) / 3;

}

function getIndexArray( vertexCount, BufferConstructor = ArrayBuffer ) {

	if ( vertexCount > 65535 ) {

		return new Uint32Array( new BufferConstructor( 4 * vertexCount ) );

	} else {

		return new Uint16Array( new BufferConstructor( 2 * vertexCount ) );

	}

}

// ensures that an index is present on the geometry
function ensureIndex( geo, options ) {

	if ( ! geo.index ) {

		const vertexCount = geo.attributes.position.count;
		const BufferConstructor = options.useSharedArrayBuffer ? SharedArrayBuffer : ArrayBuffer;
		const index = getIndexArray( vertexCount, BufferConstructor );
		geo.setIndex( new BufferAttribute( index, 1 ) );

		for ( let i = 0; i < vertexCount; i ++ ) {

			index[ i ] = i;

		}

	}

}

// Computes the set of { offset, count } ranges which need independent BVH roots. Each
// region in the geometry index that belongs to a different set of material groups requires
// a separate BVH root, so that triangles indices belonging to one group never get swapped
// with triangle indices belongs to another group. For example, if the groups were like this:
//
// [-------------------------------------------------------------]
// |__________________|
//   g0 = [0, 20]  |______________________||_____________________|
//                      g1 = [16, 40]           g2 = [41, 60]
//
// we would need four BVH roots: [0, 15], [16, 20], [21, 40], [41, 60].
function getFullGeometryRange( geo ) {

	const triCount = getTriCount( geo );
	const drawRange = geo.drawRange;
	const start = drawRange.start / 3;
	const end = ( drawRange.start + drawRange.count ) / 3;

	const offset = Math.max( 0, start );
	const count = Math.min( triCount, end ) - offset;
	return [ {
		offset: Math.floor( offset ),
		count: Math.floor( count ),
	} ];

}

function getRootIndexRanges( geo ) {

	if ( ! geo.groups || ! geo.groups.length ) {

		return getFullGeometryRange( geo );

	}

	const ranges = [];
	const rangeBoundaries = new Set();

	const drawRange = geo.drawRange;
	const drawRangeStart = drawRange.start / 3;
	const drawRangeEnd = ( drawRange.start + drawRange.count ) / 3;
	for ( const group of geo.groups ) {

		const groupStart = group.start / 3;
		const groupEnd = ( group.start + group.count ) / 3;
		rangeBoundaries.add( Math.max( drawRangeStart, groupStart ) );
		rangeBoundaries.add( Math.min( drawRangeEnd, groupEnd ) );

	}


	// note that if you don't pass in a comparator, it sorts them lexicographically as strings :-(
	const sortedBoundaries = Array.from( rangeBoundaries.values() ).sort( ( a, b ) => a - b );
	for ( let i = 0; i < sortedBoundaries.length - 1; i ++ ) {

		const start = sortedBoundaries[ i ];
		const end = sortedBoundaries[ i + 1 ];

		ranges.push( {
			offset: Math.floor( start ),
			count: Math.floor( end - start ),
		} );

	}

	return ranges;

}

function hasGroupGaps( geometry ) {

	if ( geometry.groups.length === 0 ) {

		return false;

	}

	const vertexCount = getTriCount( geometry );
	const groups = getRootIndexRanges( geometry )
		.sort( ( a, b ) => a.offset - b.offset );

	const finalGroup = groups[ groups.length - 1 ];
	finalGroup.count = Math.min( vertexCount - finalGroup.offset, finalGroup.count );

	let total = 0;
	groups.forEach( ( { count } ) => total += count );
	return vertexCount !== total;

}

// computes the union of the bounds of all of the given triangles and puts the resulting box in "target".
// A bounding box is computed for the centroids of the triangles, as well, and placed in "centroidTarget".
// These are computed together to avoid redundant accesses to bounds array.
function getBounds( triangleBounds, offset, count, target, centroidTarget ) {

	let minx = Infinity;
	let miny = Infinity;
	let minz = Infinity;
	let maxx = - Infinity;
	let maxy = - Infinity;
	let maxz = - Infinity;

	let cminx = Infinity;
	let cminy = Infinity;
	let cminz = Infinity;
	let cmaxx = - Infinity;
	let cmaxy = - Infinity;
	let cmaxz = - Infinity;

	for ( let i = offset * 6, end = ( offset + count ) * 6; i < end; i += 6 ) {

		const cx = triangleBounds[ i + 0 ];
		const hx = triangleBounds[ i + 1 ];
		const lx = cx - hx;
		const rx = cx + hx;
		if ( lx < minx ) minx = lx;
		if ( rx > maxx ) maxx = rx;
		if ( cx < cminx ) cminx = cx;
		if ( cx > cmaxx ) cmaxx = cx;

		const cy = triangleBounds[ i + 2 ];
		const hy = triangleBounds[ i + 3 ];
		const ly = cy - hy;
		const ry = cy + hy;
		if ( ly < miny ) miny = ly;
		if ( ry > maxy ) maxy = ry;
		if ( cy < cminy ) cminy = cy;
		if ( cy > cmaxy ) cmaxy = cy;

		const cz = triangleBounds[ i + 4 ];
		const hz = triangleBounds[ i + 5 ];
		const lz = cz - hz;
		const rz = cz + hz;
		if ( lz < minz ) minz = lz;
		if ( rz > maxz ) maxz = rz;
		if ( cz < cminz ) cminz = cz;
		if ( cz > cmaxz ) cmaxz = cz;

	}

	target[ 0 ] = minx;
	target[ 1 ] = miny;
	target[ 2 ] = minz;

	target[ 3 ] = maxx;
	target[ 4 ] = maxy;
	target[ 5 ] = maxz;

	centroidTarget[ 0 ] = cminx;
	centroidTarget[ 1 ] = cminy;
	centroidTarget[ 2 ] = cminz;

	centroidTarget[ 3 ] = cmaxx;
	centroidTarget[ 4 ] = cmaxy;
	centroidTarget[ 5 ] = cmaxz;

}

// precomputes the bounding box for each triangle; required for quickly calculating tree splits.
// result is an array of size tris.length * 6 where triangle i maps to a
// [x_center, x_delta, y_center, y_delta, z_center, z_delta] tuple starting at index i * 6,
// representing the center and half-extent in each dimension of triangle i
function computeTriangleBounds( geo, target = null, offset = null, count = null ) {

	const posAttr = geo.attributes.position;
	const index = geo.index ? geo.index.array : null;
	const triCount = getTriCount( geo );
	const normalized = posAttr.normalized;
	let triangleBounds;
	if ( target === null ) {

		triangleBounds = new Float32Array( triCount * 6 * 4 );
		offset = 0;
		count = triCount;

	} else {

		triangleBounds = target;
		offset = offset || 0;
		count = count || triCount;

	}

	// used for non-normalized positions
	const posArr = posAttr.array;

	// support for an interleaved position buffer
	const bufferOffset = posAttr.offset || 0;
	let stride = 3;
	if ( posAttr.isInterleavedBufferAttribute ) {

		stride = posAttr.data.stride;

	}

	// used for normalized positions
	const getters = [ 'getX', 'getY', 'getZ' ];

	for ( let tri = offset; tri < offset + count; tri ++ ) {

		const tri3 = tri * 3;
		const tri6 = tri * 6;

		let ai = tri3 + 0;
		let bi = tri3 + 1;
		let ci = tri3 + 2;

		if ( index ) {

			ai = index[ ai ];
			bi = index[ bi ];
			ci = index[ ci ];

		}

		// we add the stride and offset here since we access the array directly
		// below for the sake of performance
		if ( ! normalized ) {

			ai = ai * stride + bufferOffset;
			bi = bi * stride + bufferOffset;
			ci = ci * stride + bufferOffset;

		}

		for ( let el = 0; el < 3; el ++ ) {

			let a, b, c;

			if ( normalized ) {

				a = posAttr[ getters[ el ] ]( ai );
				b = posAttr[ getters[ el ] ]( bi );
				c = posAttr[ getters[ el ] ]( ci );

			} else {

				a = posArr[ ai + el ];
				b = posArr[ bi + el ];
				c = posArr[ ci + el ];

			}

			let min = a;
			if ( b < min ) min = b;
			if ( c < min ) min = c;

			let max = a;
			if ( b > max ) max = b;
			if ( c > max ) max = c;

			// Increase the bounds size by float32 epsilon to avoid precision errors when
			// converting to 32 bit float. Scale the epsilon by the size of the numbers being
			// worked with.
			const halfExtents = ( max - min ) / 2;
			const el2 = el * 2;
			triangleBounds[ tri6 + el2 + 0 ] = min + halfExtents;
			triangleBounds[ tri6 + el2 + 1 ] = halfExtents + ( Math.abs( min ) + halfExtents ) * FLOAT32_EPSILON;

		}

	}

	return triangleBounds;

}

function arrayToBox( nodeIndex32, array, target ) {

	target.min.x = array[ nodeIndex32 ];
	target.min.y = array[ nodeIndex32 + 1 ];
	target.min.z = array[ nodeIndex32 + 2 ];

	target.max.x = array[ nodeIndex32 + 3 ];
	target.max.y = array[ nodeIndex32 + 4 ];
	target.max.z = array[ nodeIndex32 + 5 ];

	return target;

}

function makeEmptyBounds( target ) {

	target[ 0 ] = target[ 1 ] = target[ 2 ] = Infinity;
	target[ 3 ] = target[ 4 ] = target[ 5 ] = - Infinity;

}

function getLongestEdgeIndex( bounds ) {

	let splitDimIdx = - 1;
	let splitDist = - Infinity;

	for ( let i = 0; i < 3; i ++ ) {

		const dist = bounds[ i + 3 ] - bounds[ i ];
		if ( dist > splitDist ) {

			splitDist = dist;
			splitDimIdx = i;

		}

	}

	return splitDimIdx;

}

// copies bounds a into bounds b
function copyBounds( source, target ) {

	target.set( source );

}

// sets bounds target to the union of bounds a and b
function unionBounds( a, b, target ) {

	let aVal, bVal;
	for ( let d = 0; d < 3; d ++ ) {

		const d3 = d + 3;

		// set the minimum values
		aVal = a[ d ];
		bVal = b[ d ];
		target[ d ] = aVal < bVal ? aVal : bVal;

		// set the max values
		aVal = a[ d3 ];
		bVal = b[ d3 ];
		target[ d3 ] = aVal > bVal ? aVal : bVal;

	}

}

// expands the given bounds by the provided triangle bounds
function expandByTriangleBounds( startIndex, triangleBounds, bounds ) {

	for ( let d = 0; d < 3; d ++ ) {

		const tCenter = triangleBounds[ startIndex + 2 * d ];
		const tHalf = triangleBounds[ startIndex + 2 * d + 1 ];

		const tMin = tCenter - tHalf;
		const tMax = tCenter + tHalf;

		if ( tMin < bounds[ d ] ) {

			bounds[ d ] = tMin;

		}

		if ( tMax > bounds[ d + 3 ] ) {

			bounds[ d + 3 ] = tMax;

		}

	}

}

// compute bounds surface area
function computeSurfaceArea( bounds ) {

	const d0 = bounds[ 3 ] - bounds[ 0 ];
	const d1 = bounds[ 4 ] - bounds[ 1 ];
	const d2 = bounds[ 5 ] - bounds[ 2 ];

	return 2 * ( d0 * d1 + d1 * d2 + d2 * d0 );

}

const BIN_COUNT = 32;
const binsSort = ( a, b ) => a.candidate - b.candidate;
const sahBins = new Array( BIN_COUNT ).fill().map( () => {

	return {

		count: 0,
		bounds: new Float32Array( 6 ),
		rightCacheBounds: new Float32Array( 6 ),
		leftCacheBounds: new Float32Array( 6 ),
		candidate: 0,

	};

} );
const leftBounds = new Float32Array( 6 );

function getOptimalSplit( nodeBoundingData, centroidBoundingData, triangleBounds, offset, count, strategy ) {

	let axis = - 1;
	let pos = 0;

	// Center
	if ( strategy === CENTER ) {

		axis = getLongestEdgeIndex( centroidBoundingData );
		if ( axis !== - 1 ) {

			pos = ( centroidBoundingData[ axis ] + centroidBoundingData[ axis + 3 ] ) / 2;

		}

	} else if ( strategy === AVERAGE ) {

		axis = getLongestEdgeIndex( nodeBoundingData );
		if ( axis !== - 1 ) {

			pos = getAverage( triangleBounds, offset, count, axis );

		}

	} else if ( strategy === SAH ) {

		const rootSurfaceArea = computeSurfaceArea( nodeBoundingData );
		let bestCost = TRIANGLE_INTERSECT_COST * count;

		// iterate over all axes
		const cStart = offset * 6;
		const cEnd = ( offset + count ) * 6;
		for ( let a = 0; a < 3; a ++ ) {

			const axisLeft = centroidBoundingData[ a ];
			const axisRight = centroidBoundingData[ a + 3 ];
			const axisLength = axisRight - axisLeft;
			const binWidth = axisLength / BIN_COUNT;

			// If we have fewer triangles than we're planning to split then just check all
			// the triangle positions because it will be faster.
			if ( count < BIN_COUNT / 4 ) {

				// initialize the bin candidates
				const truncatedBins = [ ...sahBins ];
				truncatedBins.length = count;

				// set the candidates
				let b = 0;
				for ( let c = cStart; c < cEnd; c += 6, b ++ ) {

					const bin = truncatedBins[ b ];
					bin.candidate = triangleBounds[ c + 2 * a ];
					bin.count = 0;

					const {
						bounds,
						leftCacheBounds,
						rightCacheBounds,
					} = bin;
					for ( let d = 0; d < 3; d ++ ) {

						rightCacheBounds[ d ] = Infinity;
						rightCacheBounds[ d + 3 ] = - Infinity;

						leftCacheBounds[ d ] = Infinity;
						leftCacheBounds[ d + 3 ] = - Infinity;

						bounds[ d ] = Infinity;
						bounds[ d + 3 ] = - Infinity;

					}

					expandByTriangleBounds( c, triangleBounds, bounds );

				}

				truncatedBins.sort( binsSort );

				// remove redundant splits
				let splitCount = count;
				for ( let bi = 0; bi < splitCount; bi ++ ) {

					const bin = truncatedBins[ bi ];
					while ( bi + 1 < splitCount && truncatedBins[ bi + 1 ].candidate === bin.candidate ) {

						truncatedBins.splice( bi + 1, 1 );
						splitCount --;

					}

				}

				// find the appropriate bin for each triangle and expand the bounds.
				for ( let c = cStart; c < cEnd; c += 6 ) {

					const center = triangleBounds[ c + 2 * a ];
					for ( let bi = 0; bi < splitCount; bi ++ ) {

						const bin = truncatedBins[ bi ];
						if ( center >= bin.candidate ) {

							expandByTriangleBounds( c, triangleBounds, bin.rightCacheBounds );

						} else {

							expandByTriangleBounds( c, triangleBounds, bin.leftCacheBounds );
							bin.count ++;

						}

					}

				}

				// expand all the bounds
				for ( let bi = 0; bi < splitCount; bi ++ ) {

					const bin = truncatedBins[ bi ];
					const leftCount = bin.count;
					const rightCount = count - bin.count;

					// check the cost of this split
					const leftBounds = bin.leftCacheBounds;
					const rightBounds = bin.rightCacheBounds;

					let leftProb = 0;
					if ( leftCount !== 0 ) {

						leftProb = computeSurfaceArea( leftBounds ) / rootSurfaceArea;

					}

					let rightProb = 0;
					if ( rightCount !== 0 ) {

						rightProb = computeSurfaceArea( rightBounds ) / rootSurfaceArea;

					}

					const cost = TRAVERSAL_COST + TRIANGLE_INTERSECT_COST * (
						leftProb * leftCount + rightProb * rightCount
					);

					if ( cost < bestCost ) {

						axis = a;
						bestCost = cost;
						pos = bin.candidate;

					}

				}

			} else {

				// reset the bins
				for ( let i = 0; i < BIN_COUNT; i ++ ) {

					const bin = sahBins[ i ];
					bin.count = 0;
					bin.candidate = axisLeft + binWidth + i * binWidth;

					const bounds = bin.bounds;
					for ( let d = 0; d < 3; d ++ ) {

						bounds[ d ] = Infinity;
						bounds[ d + 3 ] = - Infinity;

					}

				}

				// iterate over all center positions
				for ( let c = cStart; c < cEnd; c += 6 ) {

					const triCenter = triangleBounds[ c + 2 * a ];
					const relativeCenter = triCenter - axisLeft;

					// in the partition function if the centroid lies on the split plane then it is
					// considered to be on the right side of the split
					let binIndex = ~ ~ ( relativeCenter / binWidth );
					if ( binIndex >= BIN_COUNT ) binIndex = BIN_COUNT - 1;

					const bin = sahBins[ binIndex ];
					bin.count ++;

					expandByTriangleBounds( c, triangleBounds, bin.bounds );

				}

				// cache the unioned bounds from right to left so we don't have to regenerate them each time
				const lastBin = sahBins[ BIN_COUNT - 1 ];
				copyBounds( lastBin.bounds, lastBin.rightCacheBounds );
				for ( let i = BIN_COUNT - 2; i >= 0; i -- ) {

					const bin = sahBins[ i ];
					const nextBin = sahBins[ i + 1 ];
					unionBounds( bin.bounds, nextBin.rightCacheBounds, bin.rightCacheBounds );

				}

				let leftCount = 0;
				for ( let i = 0; i < BIN_COUNT - 1; i ++ ) {

					const bin = sahBins[ i ];
					const binCount = bin.count;
					const bounds = bin.bounds;

					const nextBin = sahBins[ i + 1 ];
					const rightBounds = nextBin.rightCacheBounds;

					// don't do anything with the bounds if the new bounds have no triangles
					if ( binCount !== 0 ) {

						if ( leftCount === 0 ) {

							copyBounds( bounds, leftBounds );

						} else {

							unionBounds( bounds, leftBounds, leftBounds );

						}

					}

					leftCount += binCount;

					// check the cost of this split
					let leftProb = 0;
					let rightProb = 0;

					if ( leftCount !== 0 ) {

						leftProb = computeSurfaceArea( leftBounds ) / rootSurfaceArea;

					}

					const rightCount = count - leftCount;
					if ( rightCount !== 0 ) {

						rightProb = computeSurfaceArea( rightBounds ) / rootSurfaceArea;

					}

					const cost = TRAVERSAL_COST + TRIANGLE_INTERSECT_COST * (
						leftProb * leftCount + rightProb * rightCount
					);

					if ( cost < bestCost ) {

						axis = a;
						bestCost = cost;
						pos = bin.candidate;

					}

				}

			}

		}

	} else {

		console.warn( `MeshBVH: Invalid build strategy value ${ strategy } used.` );

	}

	return { axis, pos };

}

// returns the average coordinate on the specified axis of the all the provided triangles
function getAverage( triangleBounds, offset, count, axis ) {

	let avg = 0;
	for ( let i = offset, end = offset + count; i < end; i ++ ) {

		avg += triangleBounds[ i * 6 + axis * 2 ];

	}

	return avg / count;

}

class MeshBVHNode {

	constructor() {

		// internal nodes have boundingData, left, right, and splitAxis
		// leaf nodes have offset and count (referring to primitives in the mesh geometry)

		this.boundingData = new Float32Array( 6 );

	}

}

/********************************************************/
/* This file is generated from "sortUtils.template.js". */
/********************************************************/
// reorders `tris` such that for `count` elements after `offset`, elements on the left side of the split
// will be on the left and elements on the right side of the split will be on the right. returns the index
// of the first element on the right side, or offset + count if there are no elements on the right side.
function partition( indirectBuffer, index, triangleBounds, offset, count, split ) {

	let left = offset;
	let right = offset + count - 1;
	const pos = split.pos;
	const axisOffset = split.axis * 2;

	// hoare partitioning, see e.g. https://en.wikipedia.org/wiki/Quicksort#Hoare_partition_scheme
	while ( true ) {

		while ( left <= right && triangleBounds[ left * 6 + axisOffset ] < pos ) {

			left ++;

		}

		// if a triangle center lies on the partition plane it is considered to be on the right side
		while ( left <= right && triangleBounds[ right * 6 + axisOffset ] >= pos ) {

			right --;

		}

		if ( left < right ) {

			// we need to swap all of the information associated with the triangles at index
			// left and right; that's the verts in the geometry index, the bounds,
			// and perhaps the SAH planes

			for ( let i = 0; i < 3; i ++ ) {

				let t0 = index[ left * 3 + i ];
				index[ left * 3 + i ] = index[ right * 3 + i ];
				index[ right * 3 + i ] = t0;

			}


			// swap bounds
			for ( let i = 0; i < 6; i ++ ) {

				let tb = triangleBounds[ left * 6 + i ];
				triangleBounds[ left * 6 + i ] = triangleBounds[ right * 6 + i ];
				triangleBounds[ right * 6 + i ] = tb;

			}

			left ++;
			right --;

		} else {

			return left;

		}

	}

}

/********************************************************/
/* This file is generated from "sortUtils.template.js". */
/********************************************************/
// reorders `tris` such that for `count` elements after `offset`, elements on the left side of the split
// will be on the left and elements on the right side of the split will be on the right. returns the index
// of the first element on the right side, or offset + count if there are no elements on the right side.
function partition_indirect( indirectBuffer, index, triangleBounds, offset, count, split ) {

	let left = offset;
	let right = offset + count - 1;
	const pos = split.pos;
	const axisOffset = split.axis * 2;

	// hoare partitioning, see e.g. https://en.wikipedia.org/wiki/Quicksort#Hoare_partition_scheme
	while ( true ) {

		while ( left <= right && triangleBounds[ left * 6 + axisOffset ] < pos ) {

			left ++;

		}

		// if a triangle center lies on the partition plane it is considered to be on the right side
		while ( left <= right && triangleBounds[ right * 6 + axisOffset ] >= pos ) {

			right --;

		}

		if ( left < right ) {

			// we need to swap all of the information associated with the triangles at index
			// left and right; that's the verts in the geometry index, the bounds,
			// and perhaps the SAH planes
			let t = indirectBuffer[ left ];
			indirectBuffer[ left ] = indirectBuffer[ right ];
			indirectBuffer[ right ] = t;


			// swap bounds
			for ( let i = 0; i < 6; i ++ ) {

				let tb = triangleBounds[ left * 6 + i ];
				triangleBounds[ left * 6 + i ] = triangleBounds[ right * 6 + i ];
				triangleBounds[ right * 6 + i ] = tb;

			}

			left ++;
			right --;

		} else {

			return left;

		}

	}

}

function IS_LEAF( n16, uint16Array ) {

	return uint16Array[ n16 + 15 ] === 0xFFFF;

}

function OFFSET( n32, uint32Array ) {

	return uint32Array[ n32 + 6 ];

}

function COUNT( n16, uint16Array ) {

	return uint16Array[ n16 + 14 ];

}

function LEFT_NODE( n32 ) {

	return n32 + 8;

}

function RIGHT_NODE( n32, uint32Array ) {

	return uint32Array[ n32 + 6 ];

}

function SPLIT_AXIS( n32, uint32Array ) {

	return uint32Array[ n32 + 7 ];

}

function BOUNDING_DATA_INDEX( n32 ) {

	return n32;

}

let float32Array, uint32Array, uint16Array, uint8Array;
const MAX_POINTER = Math.pow( 2, 32 );

function countNodes( node ) {

	if ( 'count' in node ) {

		return 1;

	} else {

		return 1 + countNodes( node.left ) + countNodes( node.right );

	}

}

function populateBuffer( byteOffset, node, buffer ) {

	float32Array = new Float32Array( buffer );
	uint32Array = new Uint32Array( buffer );
	uint16Array = new Uint16Array( buffer );
	uint8Array = new Uint8Array( buffer );

	return _populateBuffer( byteOffset, node );

}

// pack structure
// boundingData  				: 6 float32
// right / offset 				: 1 uint32
// splitAxis / isLeaf + count 	: 1 uint32 / 2 uint16
function _populateBuffer( byteOffset, node ) {

	const stride4Offset = byteOffset / 4;
	const stride2Offset = byteOffset / 2;
	const isLeaf = 'count' in node;
	const boundingData = node.boundingData;
	for ( let i = 0; i < 6; i ++ ) {

		float32Array[ stride4Offset + i ] = boundingData[ i ];

	}

	if ( isLeaf ) {

		if ( node.buffer ) {

			const buffer = node.buffer;
			uint8Array.set( new Uint8Array( buffer ), byteOffset );

			for ( let offset = byteOffset, l = byteOffset + buffer.byteLength; offset < l; offset += BYTES_PER_NODE ) {

				const offset2 = offset / 2;
				if ( ! IS_LEAF( offset2, uint16Array ) ) {

					uint32Array[ ( offset / 4 ) + 6 ] += stride4Offset;


				}

			}

			return byteOffset + buffer.byteLength;

		} else {

			const offset = node.offset;
			const count = node.count;
			uint32Array[ stride4Offset + 6 ] = offset;
			uint16Array[ stride2Offset + 14 ] = count;
			uint16Array[ stride2Offset + 15 ] = IS_LEAFNODE_FLAG;
			return byteOffset + BYTES_PER_NODE;

		}

	} else {

		const left = node.left;
		const right = node.right;
		const splitAxis = node.splitAxis;

		let nextUnusedPointer;
		nextUnusedPointer = _populateBuffer( byteOffset + BYTES_PER_NODE, left );

		if ( ( nextUnusedPointer / 4 ) > MAX_POINTER ) {

			throw new Error( 'MeshBVH: Cannot store child pointer greater than 32 bits.' );

		}

		uint32Array[ stride4Offset + 6 ] = nextUnusedPointer / 4;
		nextUnusedPointer = _populateBuffer( nextUnusedPointer, right );

		uint32Array[ stride4Offset + 7 ] = splitAxis;
		return nextUnusedPointer;

	}

}

function generateIndirectBuffer( geometry, useSharedArrayBuffer ) {

	const triCount = ( geometry.index ? geometry.index.count : geometry.attributes.position.count ) / 3;
	const useUint32 = triCount > 2 ** 16;
	const byteCount = useUint32 ? 4 : 2;

	const buffer = useSharedArrayBuffer ? new SharedArrayBuffer( triCount * byteCount ) : new ArrayBuffer( triCount * byteCount );
	const indirectBuffer = useUint32 ? new Uint32Array( buffer ) : new Uint16Array( buffer );
	for ( let i = 0, l = indirectBuffer.length; i < l; i ++ ) {

		indirectBuffer[ i ] = i;

	}

	return indirectBuffer;

}

function buildTree( bvh, triangleBounds, offset, count, options ) {

	// epxand variables
	const {
		maxDepth,
		verbose,
		maxLeafTris,
		strategy,
		onProgress,
		indirect,
	} = options;
	const indirectBuffer = bvh._indirectBuffer;
	const geometry = bvh.geometry;
	const indexArray = geometry.index ? geometry.index.array : null;
	const partionFunc = indirect ? partition_indirect : partition;

	// generate intermediate variables
	const totalTriangles = getTriCount( geometry );
	const cacheCentroidBoundingData = new Float32Array( 6 );
	let reachedMaxDepth = false;

	const root = new MeshBVHNode();
	getBounds( triangleBounds, offset, count, root.boundingData, cacheCentroidBoundingData );
	splitNode( root, offset, count, cacheCentroidBoundingData );
	return root;

	function triggerProgress( trianglesProcessed ) {

		if ( onProgress ) {

			onProgress( trianglesProcessed / totalTriangles );

		}

	}

	// either recursively splits the given node, creating left and right subtrees for it, or makes it a leaf node,
	// recording the offset and count of its triangles and writing them into the reordered geometry index.
	function splitNode( node, offset, count, centroidBoundingData = null, depth = 0 ) {

		if ( ! reachedMaxDepth && depth >= maxDepth ) {

			reachedMaxDepth = true;
			if ( verbose ) {

				console.warn( `MeshBVH: Max depth of ${ maxDepth } reached when generating BVH. Consider increasing maxDepth.` );
				console.warn( geometry );

			}

		}

		// early out if we've met our capacity
		if ( count <= maxLeafTris || depth >= maxDepth ) {

			triggerProgress( offset + count );
			node.offset = offset;
			node.count = count;
			return node;

		}

		// Find where to split the volume
		const split = getOptimalSplit( node.boundingData, centroidBoundingData, triangleBounds, offset, count, strategy );
		if ( split.axis === - 1 ) {

			triggerProgress( offset + count );
			node.offset = offset;
			node.count = count;
			return node;

		}

		const splitOffset = partionFunc( indirectBuffer, indexArray, triangleBounds, offset, count, split );

		// create the two new child nodes
		if ( splitOffset === offset || splitOffset === offset + count ) {

			triggerProgress( offset + count );
			node.offset = offset;
			node.count = count;

		} else {

			node.splitAxis = split.axis;

			// create the left child and compute its bounding box
			const left = new MeshBVHNode();
			const lstart = offset;
			const lcount = splitOffset - offset;
			node.left = left;

			getBounds( triangleBounds, lstart, lcount, left.boundingData, cacheCentroidBoundingData );
			splitNode( left, lstart, lcount, cacheCentroidBoundingData, depth + 1 );

			// repeat for right
			const right = new MeshBVHNode();
			const rstart = splitOffset;
			const rcount = count - lcount;
			node.right = right;

			getBounds( triangleBounds, rstart, rcount, right.boundingData, cacheCentroidBoundingData );
			splitNode( right, rstart, rcount, cacheCentroidBoundingData, depth + 1 );

		}

		return node;

	}

}

function buildPackedTree( bvh, options ) {

	const geometry = bvh.geometry;
	if ( options.indirect ) {

		bvh._indirectBuffer = generateIndirectBuffer( geometry, options.useSharedArrayBuffer );

		if ( hasGroupGaps( geometry ) && ! options.verbose ) {

			console.warn(
				'MeshBVH: Provided geometry contains groups that do not fully span the vertex contents while using the "indirect" option. ' +
				'BVH may incorrectly report intersections on unrendered portions of the geometry.'
			);

		}

	}

	if ( ! bvh._indirectBuffer ) {

		ensureIndex( geometry, options );

	}

	const BufferConstructor = options.useSharedArrayBuffer ? SharedArrayBuffer : ArrayBuffer;

	const triangleBounds = computeTriangleBounds( geometry );
	const geometryRanges = options.indirect ? getFullGeometryRange( geometry ) : getRootIndexRanges( geometry );
	bvh._roots = geometryRanges.map( range => {

		const root = buildTree( bvh, triangleBounds, range.offset, range.count, options );
		const nodeCount = countNodes( root );
		const buffer = new BufferConstructor( BYTES_PER_NODE * nodeCount );
		populateBuffer( 0, root, buffer );
		return buffer;

	} );

}

class SeparatingAxisBounds {

	constructor() {

		this.min = Infinity;
		this.max = - Infinity;

	}

	setFromPointsField( points, field ) {

		let min = Infinity;
		let max = - Infinity;
		for ( let i = 0, l = points.length; i < l; i ++ ) {

			const p = points[ i ];
			const val = p[ field ];
			min = val < min ? val : min;
			max = val > max ? val : max;

		}

		this.min = min;
		this.max = max;

	}

	setFromPoints( axis, points ) {

		let min = Infinity;
		let max = - Infinity;
		for ( let i = 0, l = points.length; i < l; i ++ ) {

			const p = points[ i ];
			const val = axis.dot( p );
			min = val < min ? val : min;
			max = val > max ? val : max;

		}

		this.min = min;
		this.max = max;

	}

	isSeparated( other ) {

		return this.min > other.max || other.min > this.max;

	}

}

SeparatingAxisBounds.prototype.setFromBox = ( function () {

	const p = new Vector3();
	return function setFromBox( axis, box ) {

		const boxMin = box.min;
		const boxMax = box.max;
		let min = Infinity;
		let max = - Infinity;
		for ( let x = 0; x <= 1; x ++ ) {

			for ( let y = 0; y <= 1; y ++ ) {

				for ( let z = 0; z <= 1; z ++ ) {

					p.x = boxMin.x * x + boxMax.x * ( 1 - x );
					p.y = boxMin.y * y + boxMax.y * ( 1 - y );
					p.z = boxMin.z * z + boxMax.z * ( 1 - z );

					const val = axis.dot( p );
					min = Math.min( val, min );
					max = Math.max( val, max );

				}

			}

		}

		this.min = min;
		this.max = max;

	};

} )();

const areIntersecting = ( function () {

	const cacheSatBounds = new SeparatingAxisBounds();
	return function areIntersecting( shape1, shape2 ) {

		const points1 = shape1.points;
		const satAxes1 = shape1.satAxes;
		const satBounds1 = shape1.satBounds;

		const points2 = shape2.points;
		const satAxes2 = shape2.satAxes;
		const satBounds2 = shape2.satBounds;

		// check axes of the first shape
		for ( let i = 0; i < 3; i ++ ) {

			const sb = satBounds1[ i ];
			const sa = satAxes1[ i ];
			cacheSatBounds.setFromPoints( sa, points2 );
			if ( sb.isSeparated( cacheSatBounds ) ) return false;

		}

		// check axes of the second shape
		for ( let i = 0; i < 3; i ++ ) {

			const sb = satBounds2[ i ];
			const sa = satAxes2[ i ];
			cacheSatBounds.setFromPoints( sa, points1 );
			if ( sb.isSeparated( cacheSatBounds ) ) return false;

		}

	};

} )();

const closestPointLineToLine = ( function () {

	// https://github.com/juj/MathGeoLib/blob/master/src/Geometry/Line.cpp#L56
	const dir1 = new Vector3();
	const dir2 = new Vector3();
	const v02 = new Vector3();
	return function closestPointLineToLine( l1, l2, result ) {

		const v0 = l1.start;
		const v10 = dir1;
		const v2 = l2.start;
		const v32 = dir2;

		v02.subVectors( v0, v2 );
		dir1.subVectors( l1.end, l1.start );
		dir2.subVectors( l2.end, l2.start );

		// float d0232 = v02.Dot(v32);
		const d0232 = v02.dot( v32 );

		// float d3210 = v32.Dot(v10);
		const d3210 = v32.dot( v10 );

		// float d3232 = v32.Dot(v32);
		const d3232 = v32.dot( v32 );

		// float d0210 = v02.Dot(v10);
		const d0210 = v02.dot( v10 );

		// float d1010 = v10.Dot(v10);
		const d1010 = v10.dot( v10 );

		// float denom = d1010*d3232 - d3210*d3210;
		const denom = d1010 * d3232 - d3210 * d3210;

		let d, d2;
		if ( denom !== 0 ) {

			d = ( d0232 * d3210 - d0210 * d3232 ) / denom;

		} else {

			d = 0;

		}

		d2 = ( d0232 + d * d3210 ) / d3232;

		result.x = d;
		result.y = d2;

	};

} )();

const closestPointsSegmentToSegment = ( function () {

	// https://github.com/juj/MathGeoLib/blob/master/src/Geometry/LineSegment.cpp#L187
	const paramResult = new Vector2();
	const temp1 = new Vector3();
	const temp2 = new Vector3();
	return function closestPointsSegmentToSegment( l1, l2, target1, target2 ) {

		closestPointLineToLine( l1, l2, paramResult );

		let d = paramResult.x;
		let d2 = paramResult.y;
		if ( d >= 0 && d <= 1 && d2 >= 0 && d2 <= 1 ) {

			l1.at( d, target1 );
			l2.at( d2, target2 );

			return;

		} else if ( d >= 0 && d <= 1 ) {

			// Only d2 is out of bounds.
			if ( d2 < 0 ) {

				l2.at( 0, target2 );

			} else {

				l2.at( 1, target2 );

			}

			l1.closestPointToPoint( target2, true, target1 );
			return;

		} else if ( d2 >= 0 && d2 <= 1 ) {

			// Only d is out of bounds.
			if ( d < 0 ) {

				l1.at( 0, target1 );

			} else {

				l1.at( 1, target1 );

			}

			l2.closestPointToPoint( target1, true, target2 );
			return;

		} else {

			// Both u and u2 are out of bounds.
			let p;
			if ( d < 0 ) {

				p = l1.start;

			} else {

				p = l1.end;

			}

			let p2;
			if ( d2 < 0 ) {

				p2 = l2.start;

			} else {

				p2 = l2.end;

			}

			const closestPoint = temp1;
			const closestPoint2 = temp2;
			l1.closestPointToPoint( p2, true, temp1 );
			l2.closestPointToPoint( p, true, temp2 );

			if ( closestPoint.distanceToSquared( p2 ) <= closestPoint2.distanceToSquared( p ) ) {

				target1.copy( closestPoint );
				target2.copy( p2 );
				return;

			} else {

				target1.copy( p );
				target2.copy( closestPoint2 );
				return;

			}

		}

	};

} )();


const sphereIntersectTriangle = ( function () {

	// https://stackoverflow.com/questions/34043955/detect-collision-between-sphere-and-triangle-in-three-js
	const closestPointTemp = new Vector3();
	const projectedPointTemp = new Vector3();
	const planeTemp = new Plane();
	const lineTemp = new Line3();
	return function sphereIntersectTriangle( sphere, triangle ) {

		const { radius, center } = sphere;
		const { a, b, c } = triangle;

		// phase 1
		lineTemp.start = a;
		lineTemp.end = b;
		const closestPoint1 = lineTemp.closestPointToPoint( center, true, closestPointTemp );
		if ( closestPoint1.distanceTo( center ) <= radius ) return true;

		lineTemp.start = a;
		lineTemp.end = c;
		const closestPoint2 = lineTemp.closestPointToPoint( center, true, closestPointTemp );
		if ( closestPoint2.distanceTo( center ) <= radius ) return true;

		lineTemp.start = b;
		lineTemp.end = c;
		const closestPoint3 = lineTemp.closestPointToPoint( center, true, closestPointTemp );
		if ( closestPoint3.distanceTo( center ) <= radius ) return true;

		// phase 2
		const plane = triangle.getPlane( planeTemp );
		const dp = Math.abs( plane.distanceToPoint( center ) );
		if ( dp <= radius ) {

			const pp = plane.projectPoint( center, projectedPointTemp );
			const cp = triangle.containsPoint( pp );
			if ( cp ) return true;

		}

		return false;

	};

} )();

const ZERO_EPSILON = 1e-15;
function isNearZero( value ) {

	return Math.abs( value ) < ZERO_EPSILON;

}

class ExtendedTriangle extends Triangle {

	constructor( ...args ) {

		super( ...args );

		this.isExtendedTriangle = true;
		this.satAxes = new Array( 4 ).fill().map( () => new Vector3() );
		this.satBounds = new Array( 4 ).fill().map( () => new SeparatingAxisBounds() );
		this.points = [ this.a, this.b, this.c ];
		this.sphere = new Sphere();
		this.plane = new Plane();
		this.needsUpdate = true;

	}

	intersectsSphere( sphere ) {

		return sphereIntersectTriangle( sphere, this );

	}

	update() {

		const a = this.a;
		const b = this.b;
		const c = this.c;
		const points = this.points;

		const satAxes = this.satAxes;
		const satBounds = this.satBounds;

		const axis0 = satAxes[ 0 ];
		const sab0 = satBounds[ 0 ];
		this.getNormal( axis0 );
		sab0.setFromPoints( axis0, points );

		const axis1 = satAxes[ 1 ];
		const sab1 = satBounds[ 1 ];
		axis1.subVectors( a, b );
		sab1.setFromPoints( axis1, points );

		const axis2 = satAxes[ 2 ];
		const sab2 = satBounds[ 2 ];
		axis2.subVectors( b, c );
		sab2.setFromPoints( axis2, points );

		const axis3 = satAxes[ 3 ];
		const sab3 = satBounds[ 3 ];
		axis3.subVectors( c, a );
		sab3.setFromPoints( axis3, points );

		this.sphere.setFromPoints( this.points );
		this.plane.setFromNormalAndCoplanarPoint( axis0, a );
		this.needsUpdate = false;

	}

}

ExtendedTriangle.prototype.closestPointToSegment = ( function () {

	const point1 = new Vector3();
	const point2 = new Vector3();
	const edge = new Line3();

	return function distanceToSegment( segment, target1 = null, target2 = null ) {

		const { start, end } = segment;
		const points = this.points;
		let distSq;
		let closestDistanceSq = Infinity;

		// check the triangle edges
		for ( let i = 0; i < 3; i ++ ) {

			const nexti = ( i + 1 ) % 3;
			edge.start.copy( points[ i ] );
			edge.end.copy( points[ nexti ] );

			closestPointsSegmentToSegment( edge, segment, point1, point2 );

			distSq = point1.distanceToSquared( point2 );
			if ( distSq < closestDistanceSq ) {

				closestDistanceSq = distSq;
				if ( target1 ) target1.copy( point1 );
				if ( target2 ) target2.copy( point2 );

			}

		}

		// check end points
		this.closestPointToPoint( start, point1 );
		distSq = start.distanceToSquared( point1 );
		if ( distSq < closestDistanceSq ) {

			closestDistanceSq = distSq;
			if ( target1 ) target1.copy( point1 );
			if ( target2 ) target2.copy( start );

		}

		this.closestPointToPoint( end, point1 );
		distSq = end.distanceToSquared( point1 );
		if ( distSq < closestDistanceSq ) {

			closestDistanceSq = distSq;
			if ( target1 ) target1.copy( point1 );
			if ( target2 ) target2.copy( end );

		}

		return Math.sqrt( closestDistanceSq );

	};

} )();

ExtendedTriangle.prototype.intersectsTriangle = ( function () {

	const saTri2 = new ExtendedTriangle();
	const arr1 = new Array( 3 );
	const arr2 = new Array( 3 );
	const cachedSatBounds = new SeparatingAxisBounds();
	const cachedSatBounds2 = new SeparatingAxisBounds();
	const cachedAxis = new Vector3();
	const dir = new Vector3();
	const dir1 = new Vector3();
	const dir2 = new Vector3();
	const tempDir = new Vector3();
	const edge = new Line3();
	const edge1 = new Line3();
	const edge2 = new Line3();
	const tempPoint = new Vector3();

	function triIntersectPlane( tri, plane, targetEdge ) {

		// find the edge that intersects the other triangle plane
		const points = tri.points;
		let count = 0;
		let startPointIntersection = - 1;
		for ( let i = 0; i < 3; i ++ ) {

			const { start, end } = edge;
			start.copy( points[ i ] );
			end.copy( points[ ( i + 1 ) % 3 ] );
			edge.delta( dir );

			const startIntersects = isNearZero( plane.distanceToPoint( start ) );
			if ( isNearZero( plane.normal.dot( dir ) ) && startIntersects ) {

				// if the edge lies on the plane then take the line
				targetEdge.copy( edge );
				count = 2;
				break;

			}

			// check if the start point is near the plane because "intersectLine" is not robust to that case
			const doesIntersect = plane.intersectLine( edge, tempPoint );
			if ( ! doesIntersect && startIntersects ) {

				tempPoint.copy( start );

			}

			// ignore the end point
			if ( ( doesIntersect || startIntersects ) && ! isNearZero( tempPoint.distanceTo( end ) ) ) {

				if ( count <= 1 ) {

					// assign to the start or end point and save which index was snapped to
					// the start point if necessary
					const point = count === 1 ? targetEdge.start : targetEdge.end;
					point.copy( tempPoint );
					if ( startIntersects ) {

						startPointIntersection = count;

					}

				} else if ( count >= 2 ) {

					// if we're here that means that there must have been one point that had
					// snapped to the start point so replace it here
					const point = startPointIntersection === 1 ? targetEdge.start : targetEdge.end;
					point.copy( tempPoint );
					count = 2;
					break;

				}

				count ++;
				if ( count === 2 && startPointIntersection === - 1 ) {

					break;

				}

			}

		}

		return count;

	}

	// TODO: If the triangles are coplanar and intersecting the target is nonsensical. It should at least
	// be a line contained by both triangles if not a different special case somehow represented in the return result.
	return function intersectsTriangle( other, target = null, suppressLog = false ) {

		if ( this.needsUpdate ) {

			this.update();

		}

		if ( ! other.isExtendedTriangle ) {

			saTri2.copy( other );
			saTri2.update();
			other = saTri2;

		} else if ( other.needsUpdate ) {

			other.update();

		}

		const plane1 = this.plane;
		const plane2 = other.plane;

		if ( Math.abs( plane1.normal.dot( plane2.normal ) ) > 1.0 - 1e-10 ) {

			// perform separating axis intersection test only for coplanar triangles
			const satBounds1 = this.satBounds;
			const satAxes1 = this.satAxes;
			arr2[ 0 ] = other.a;
			arr2[ 1 ] = other.b;
			arr2[ 2 ] = other.c;
			for ( let i = 0; i < 4; i ++ ) {

				const sb = satBounds1[ i ];
				const sa = satAxes1[ i ];
				cachedSatBounds.setFromPoints( sa, arr2 );
				if ( sb.isSeparated( cachedSatBounds ) ) return false;

			}

			const satBounds2 = other.satBounds;
			const satAxes2 = other.satAxes;
			arr1[ 0 ] = this.a;
			arr1[ 1 ] = this.b;
			arr1[ 2 ] = this.c;
			for ( let i = 0; i < 4; i ++ ) {

				const sb = satBounds2[ i ];
				const sa = satAxes2[ i ];
				cachedSatBounds.setFromPoints( sa, arr1 );
				if ( sb.isSeparated( cachedSatBounds ) ) return false;

			}

			// check crossed axes
			for ( let i = 0; i < 4; i ++ ) {

				const sa1 = satAxes1[ i ];
				for ( let i2 = 0; i2 < 4; i2 ++ ) {

					const sa2 = satAxes2[ i2 ];
					cachedAxis.crossVectors( sa1, sa2 );
					cachedSatBounds.setFromPoints( cachedAxis, arr1 );
					cachedSatBounds2.setFromPoints( cachedAxis, arr2 );
					if ( cachedSatBounds.isSeparated( cachedSatBounds2 ) ) return false;

				}

			}

			if ( target ) {

				// TODO find two points that intersect on the edges and make that the result
				if ( ! suppressLog ) {

					console.warn( 'ExtendedTriangle.intersectsTriangle: Triangles are coplanar which does not support an output edge. Setting edge to 0, 0, 0.' );

				}

				target.start.set( 0, 0, 0 );
				target.end.set( 0, 0, 0 );

			}

			return true;

		} else {

			// find the edge that intersects the other triangle plane
			const count1 = triIntersectPlane( this, plane2, edge1 );
			if ( count1 === 1 && other.containsPoint( edge1.end ) ) {

				if ( target ) {

					target.start.copy( edge1.end );
					target.end.copy( edge1.end );

				}

				return true;

			} else if ( count1 !== 2 ) {

				return false;

			}

			// find the other triangles edge that intersects this plane
			const count2 = triIntersectPlane( other, plane1, edge2 );
			if ( count2 === 1 && this.containsPoint( edge2.end ) ) {

				if ( target ) {

					target.start.copy( edge2.end );
					target.end.copy( edge2.end );

				}

				return true;

			} else if ( count2 !== 2 ) {

				return false;

			}

			// find swap the second edge so both lines are running the same direction
			edge1.delta( dir1 );
			edge2.delta( dir2 );

			if ( dir1.dot( dir2 ) < 0 ) {

				let tmp = edge2.start;
				edge2.start = edge2.end;
				edge2.end = tmp;

			}

			// check if the edges are overlapping
			const s1 = edge1.start.dot( dir1 );
			const e1 = edge1.end.dot( dir1 );
			const s2 = edge2.start.dot( dir1 );
			const e2 = edge2.end.dot( dir1 );
			const separated1 = e1 < s2;
			const separated2 = s1 < e2;

			if ( s1 !== e2 && s2 !== e1 && separated1 === separated2 ) {

				return false;

			}

			// assign the target output
			if ( target ) {

				tempDir.subVectors( edge1.start, edge2.start );
				if ( tempDir.dot( dir1 ) > 0 ) {

					target.start.copy( edge1.start );

				} else {

					target.start.copy( edge2.start );

				}

				tempDir.subVectors( edge1.end, edge2.end );
				if ( tempDir.dot( dir1 ) < 0 ) {

					target.end.copy( edge1.end );

				} else {

					target.end.copy( edge2.end );

				}

			}

			return true;

		}

	};

} )();


ExtendedTriangle.prototype.distanceToPoint = ( function () {

	const target = new Vector3();
	return function distanceToPoint( point ) {

		this.closestPointToPoint( point, target );
		return point.distanceTo( target );

	};

} )();


ExtendedTriangle.prototype.distanceToTriangle = ( function () {

	const point = new Vector3();
	const point2 = new Vector3();
	const cornerFields = [ 'a', 'b', 'c' ];
	const line1 = new Line3();
	const line2 = new Line3();

	return function distanceToTriangle( other, target1 = null, target2 = null ) {

		const lineTarget = target1 || target2 ? line1 : null;
		if ( this.intersectsTriangle( other, lineTarget ) ) {

			if ( target1 || target2 ) {

				if ( target1 ) lineTarget.getCenter( target1 );
				if ( target2 ) lineTarget.getCenter( target2 );

			}

			return 0;

		}

		let closestDistanceSq = Infinity;

		// check all point distances
		for ( let i = 0; i < 3; i ++ ) {

			let dist;
			const field = cornerFields[ i ];
			const otherVec = other[ field ];
			this.closestPointToPoint( otherVec, point );

			dist = otherVec.distanceToSquared( point );

			if ( dist < closestDistanceSq ) {

				closestDistanceSq = dist;
				if ( target1 ) target1.copy( point );
				if ( target2 ) target2.copy( otherVec );

			}


			const thisVec = this[ field ];
			other.closestPointToPoint( thisVec, point );

			dist = thisVec.distanceToSquared( point );

			if ( dist < closestDistanceSq ) {

				closestDistanceSq = dist;
				if ( target1 ) target1.copy( thisVec );
				if ( target2 ) target2.copy( point );

			}

		}

		for ( let i = 0; i < 3; i ++ ) {

			const f11 = cornerFields[ i ];
			const f12 = cornerFields[ ( i + 1 ) % 3 ];
			line1.set( this[ f11 ], this[ f12 ] );
			for ( let i2 = 0; i2 < 3; i2 ++ ) {

				const f21 = cornerFields[ i2 ];
				const f22 = cornerFields[ ( i2 + 1 ) % 3 ];
				line2.set( other[ f21 ], other[ f22 ] );

				closestPointsSegmentToSegment( line1, line2, point, point2 );

				const dist = point.distanceToSquared( point2 );
				if ( dist < closestDistanceSq ) {

					closestDistanceSq = dist;
					if ( target1 ) target1.copy( point );
					if ( target2 ) target2.copy( point2 );

				}

			}

		}

		return Math.sqrt( closestDistanceSq );

	};

} )();

class OrientedBox {

	constructor( min, max, matrix ) {

		this.isOrientedBox = true;
		this.min = new Vector3();
		this.max = new Vector3();
		this.matrix = new Matrix4();
		this.invMatrix = new Matrix4();
		this.points = new Array( 8 ).fill().map( () => new Vector3() );
		this.satAxes = new Array( 3 ).fill().map( () => new Vector3() );
		this.satBounds = new Array( 3 ).fill().map( () => new SeparatingAxisBounds() );
		this.alignedSatBounds = new Array( 3 ).fill().map( () => new SeparatingAxisBounds() );
		this.needsUpdate = false;

		if ( min ) this.min.copy( min );
		if ( max ) this.max.copy( max );
		if ( matrix ) this.matrix.copy( matrix );

	}

	set( min, max, matrix ) {

		this.min.copy( min );
		this.max.copy( max );
		this.matrix.copy( matrix );
		this.needsUpdate = true;

	}

	copy( other ) {

		this.min.copy( other.min );
		this.max.copy( other.max );
		this.matrix.copy( other.matrix );
		this.needsUpdate = true;

	}

}

OrientedBox.prototype.update = ( function () {

	return function update() {

		const matrix = this.matrix;
		const min = this.min;
		const max = this.max;

		const points = this.points;
		for ( let x = 0; x <= 1; x ++ ) {

			for ( let y = 0; y <= 1; y ++ ) {

				for ( let z = 0; z <= 1; z ++ ) {

					const i = ( ( 1 << 0 ) * x ) | ( ( 1 << 1 ) * y ) | ( ( 1 << 2 ) * z );
					const v = points[ i ];
					v.x = x ? max.x : min.x;
					v.y = y ? max.y : min.y;
					v.z = z ? max.z : min.z;

					v.applyMatrix4( matrix );

				}

			}

		}

		const satBounds = this.satBounds;
		const satAxes = this.satAxes;
		const minVec = points[ 0 ];
		for ( let i = 0; i < 3; i ++ ) {

			const axis = satAxes[ i ];
			const sb = satBounds[ i ];
			const index = 1 << i;
			const pi = points[ index ];

			axis.subVectors( minVec, pi );
			sb.setFromPoints( axis, points );

		}

		const alignedSatBounds = this.alignedSatBounds;
		alignedSatBounds[ 0 ].setFromPointsField( points, 'x' );
		alignedSatBounds[ 1 ].setFromPointsField( points, 'y' );
		alignedSatBounds[ 2 ].setFromPointsField( points, 'z' );

		this.invMatrix.copy( this.matrix ).invert();
		this.needsUpdate = false;

	};

} )();

OrientedBox.prototype.intersectsBox = ( function () {

	const aabbBounds = new SeparatingAxisBounds();
	return function intersectsBox( box ) {

		// TODO: should this be doing SAT against the AABB?
		if ( this.needsUpdate ) {

			this.update();

		}

		const min = box.min;
		const max = box.max;
		const satBounds = this.satBounds;
		const satAxes = this.satAxes;
		const alignedSatBounds = this.alignedSatBounds;

		aabbBounds.min = min.x;
		aabbBounds.max = max.x;
		if ( alignedSatBounds[ 0 ].isSeparated( aabbBounds ) ) return false;

		aabbBounds.min = min.y;
		aabbBounds.max = max.y;
		if ( alignedSatBounds[ 1 ].isSeparated( aabbBounds ) ) return false;

		aabbBounds.min = min.z;
		aabbBounds.max = max.z;
		if ( alignedSatBounds[ 2 ].isSeparated( aabbBounds ) ) return false;

		for ( let i = 0; i < 3; i ++ ) {

			const axis = satAxes[ i ];
			const sb = satBounds[ i ];
			aabbBounds.setFromBox( axis, box );
			if ( sb.isSeparated( aabbBounds ) ) return false;

		}

		return true;

	};

} )();

OrientedBox.prototype.intersectsTriangle = ( function () {

	const saTri = new ExtendedTriangle();
	const pointsArr = new Array( 3 );
	const cachedSatBounds = new SeparatingAxisBounds();
	const cachedSatBounds2 = new SeparatingAxisBounds();
	const cachedAxis = new Vector3();
	return function intersectsTriangle( triangle ) {

		if ( this.needsUpdate ) {

			this.update();

		}

		if ( ! triangle.isExtendedTriangle ) {

			saTri.copy( triangle );
			saTri.update();
			triangle = saTri;

		} else if ( triangle.needsUpdate ) {

			triangle.update();

		}

		const satBounds = this.satBounds;
		const satAxes = this.satAxes;

		pointsArr[ 0 ] = triangle.a;
		pointsArr[ 1 ] = triangle.b;
		pointsArr[ 2 ] = triangle.c;

		for ( let i = 0; i < 3; i ++ ) {

			const sb = satBounds[ i ];
			const sa = satAxes[ i ];
			cachedSatBounds.setFromPoints( sa, pointsArr );
			if ( sb.isSeparated( cachedSatBounds ) ) return false;

		}

		const triSatBounds = triangle.satBounds;
		const triSatAxes = triangle.satAxes;
		const points = this.points;
		for ( let i = 0; i < 3; i ++ ) {

			const sb = triSatBounds[ i ];
			const sa = triSatAxes[ i ];
			cachedSatBounds.setFromPoints( sa, points );
			if ( sb.isSeparated( cachedSatBounds ) ) return false;

		}

		// check crossed axes
		for ( let i = 0; i < 3; i ++ ) {

			const sa1 = satAxes[ i ];
			for ( let i2 = 0; i2 < 4; i2 ++ ) {

				const sa2 = triSatAxes[ i2 ];
				cachedAxis.crossVectors( sa1, sa2 );
				cachedSatBounds.setFromPoints( cachedAxis, pointsArr );
				cachedSatBounds2.setFromPoints( cachedAxis, points );
				if ( cachedSatBounds.isSeparated( cachedSatBounds2 ) ) return false;

			}

		}

		return true;

	};

} )();

OrientedBox.prototype.closestPointToPoint = ( function () {

	return function closestPointToPoint( point, target1 ) {

		if ( this.needsUpdate ) {

			this.update();

		}

		target1
			.copy( point )
			.applyMatrix4( this.invMatrix )
			.clamp( this.min, this.max )
			.applyMatrix4( this.matrix );

		return target1;

	};

} )();

OrientedBox.prototype.distanceToPoint = ( function () {

	const target = new Vector3();
	return function distanceToPoint( point ) {

		this.closestPointToPoint( point, target );
		return point.distanceTo( target );

	};

} )();

OrientedBox.prototype.distanceToBox = ( function () {

	const xyzFields = [ 'x', 'y', 'z' ];
	const segments1 = new Array( 12 ).fill().map( () => new Line3() );
	const segments2 = new Array( 12 ).fill().map( () => new Line3() );

	const point1 = new Vector3();
	const point2 = new Vector3();

	// early out if we find a value below threshold
	return function distanceToBox( box, threshold = 0, target1 = null, target2 = null ) {

		if ( this.needsUpdate ) {

			this.update();

		}

		if ( this.intersectsBox( box ) ) {

			if ( target1 || target2 ) {

				box.getCenter( point2 );
				this.closestPointToPoint( point2, point1 );
				box.closestPointToPoint( point1, point2 );

				if ( target1 ) target1.copy( point1 );
				if ( target2 ) target2.copy( point2 );

			}

			return 0;

		}

		const threshold2 = threshold * threshold;
		const min = box.min;
		const max = box.max;
		const points = this.points;


		// iterate over every edge and compare distances
		let closestDistanceSq = Infinity;

		// check over all these points
		for ( let i = 0; i < 8; i ++ ) {

			const p = points[ i ];
			point2.copy( p ).clamp( min, max );

			const dist = p.distanceToSquared( point2 );
			if ( dist < closestDistanceSq ) {

				closestDistanceSq = dist;
				if ( target1 ) target1.copy( p );
				if ( target2 ) target2.copy( point2 );

				if ( dist < threshold2 ) return Math.sqrt( dist );

			}

		}

		// generate and check all line segment distances
		let count = 0;
		for ( let i = 0; i < 3; i ++ ) {

			for ( let i1 = 0; i1 <= 1; i1 ++ ) {

				for ( let i2 = 0; i2 <= 1; i2 ++ ) {

					const nextIndex = ( i + 1 ) % 3;
					const nextIndex2 = ( i + 2 ) % 3;

					// get obb line segments
					const index = i1 << nextIndex | i2 << nextIndex2;
					const index2 = 1 << i | i1 << nextIndex | i2 << nextIndex2;
					const p1 = points[ index ];
					const p2 = points[ index2 ];
					const line1 = segments1[ count ];
					line1.set( p1, p2 );


					// get aabb line segments
					const f1 = xyzFields[ i ];
					const f2 = xyzFields[ nextIndex ];
					const f3 = xyzFields[ nextIndex2 ];
					const line2 = segments2[ count ];
					const start = line2.start;
					const end = line2.end;

					start[ f1 ] = min[ f1 ];
					start[ f2 ] = i1 ? min[ f2 ] : max[ f2 ];
					start[ f3 ] = i2 ? min[ f3 ] : max[ f2 ];

					end[ f1 ] = max[ f1 ];
					end[ f2 ] = i1 ? min[ f2 ] : max[ f2 ];
					end[ f3 ] = i2 ? min[ f3 ] : max[ f2 ];

					count ++;

				}

			}

		}

		// check all the other boxes point
		for ( let x = 0; x <= 1; x ++ ) {

			for ( let y = 0; y <= 1; y ++ ) {

				for ( let z = 0; z <= 1; z ++ ) {

					point2.x = x ? max.x : min.x;
					point2.y = y ? max.y : min.y;
					point2.z = z ? max.z : min.z;

					this.closestPointToPoint( point2, point1 );
					const dist = point2.distanceToSquared( point1 );
					if ( dist < closestDistanceSq ) {

						closestDistanceSq = dist;
						if ( target1 ) target1.copy( point1 );
						if ( target2 ) target2.copy( point2 );

						if ( dist < threshold2 ) return Math.sqrt( dist );

					}

				}

			}

		}

		for ( let i = 0; i < 12; i ++ ) {

			const l1 = segments1[ i ];
			for ( let i2 = 0; i2 < 12; i2 ++ ) {

				const l2 = segments2[ i2 ];
				closestPointsSegmentToSegment( l1, l2, point1, point2 );
				const dist = point1.distanceToSquared( point2 );
				if ( dist < closestDistanceSq ) {

					closestDistanceSq = dist;
					if ( target1 ) target1.copy( point1 );
					if ( target2 ) target2.copy( point2 );

					if ( dist < threshold2 ) return Math.sqrt( dist );

				}

			}

		}

		return Math.sqrt( closestDistanceSq );

	};

} )();

class PrimitivePool {

	constructor( getNewPrimitive ) {

		this._getNewPrimitive = getNewPrimitive;
		this._primitives = [];

	}

	getPrimitive() {

		const primitives = this._primitives;
		if ( primitives.length === 0 ) {

			return this._getNewPrimitive();

		} else {

			return primitives.pop();

		}

	}

	releasePrimitive( primitive ) {

		this._primitives.push( primitive );

	}

}

class ExtendedTrianglePoolBase extends PrimitivePool {

	constructor() {

		super( () => new ExtendedTriangle() );

	}

}

const ExtendedTrianglePool = /* @__PURE__ */ new ExtendedTrianglePoolBase();

class _BufferStack {

	constructor() {

		this.float32Array = null;
		this.uint16Array = null;
		this.uint32Array = null;

		const stack = [];
		let prevBuffer = null;
		this.setBuffer = buffer => {

			if ( prevBuffer ) {

				stack.push( prevBuffer );

			}

			prevBuffer = buffer;
			this.float32Array = new Float32Array( buffer );
			this.uint16Array = new Uint16Array( buffer );
			this.uint32Array = new Uint32Array( buffer );

		};

		this.clearBuffer = () => {

			prevBuffer = null;
			this.float32Array = null;
			this.uint16Array = null;
			this.uint32Array = null;

			if ( stack.length !== 0 ) {

				this.setBuffer( stack.pop() );

			}

		};

	}

}

const BufferStack = new _BufferStack();

let _box1$1, _box2$1;
const boxStack = [];
const boxPool = /* @__PURE__ */ new PrimitivePool( () => new Box3() );

function shapecast( bvh, root, intersectsBounds, intersectsRange, boundsTraverseOrder, byteOffset ) {

	// setup
	_box1$1 = boxPool.getPrimitive();
	_box2$1 = boxPool.getPrimitive();
	boxStack.push( _box1$1, _box2$1 );
	BufferStack.setBuffer( bvh._roots[ root ] );

	const result = shapecastTraverse( 0, bvh.geometry, intersectsBounds, intersectsRange, boundsTraverseOrder, byteOffset );

	// cleanup
	BufferStack.clearBuffer();
	boxPool.releasePrimitive( _box1$1 );
	boxPool.releasePrimitive( _box2$1 );
	boxStack.pop();
	boxStack.pop();

	const length = boxStack.length;
	if ( length > 0 ) {

		_box2$1 = boxStack[ length - 1 ];
		_box1$1 = boxStack[ length - 2 ];

	}

	return result;

}

function shapecastTraverse(
	nodeIndex32,
	geometry,
	intersectsBoundsFunc,
	intersectsRangeFunc,
	nodeScoreFunc = null,
	nodeIndexByteOffset = 0, // offset for unique node identifier
	depth = 0
) {

	const { float32Array, uint16Array, uint32Array } = BufferStack;
	let nodeIndex16 = nodeIndex32 * 2;

	const isLeaf = IS_LEAF( nodeIndex16, uint16Array );
	if ( isLeaf ) {

		const offset = OFFSET( nodeIndex32, uint32Array );
		const count = COUNT( nodeIndex16, uint16Array );
		arrayToBox( BOUNDING_DATA_INDEX( nodeIndex32 ), float32Array, _box1$1 );
		return intersectsRangeFunc( offset, count, false, depth, nodeIndexByteOffset + nodeIndex32, _box1$1 );

	} else {

		const left = LEFT_NODE( nodeIndex32 );
		const right = RIGHT_NODE( nodeIndex32, uint32Array );
		let c1 = left;
		let c2 = right;

		let score1, score2;
		let box1, box2;
		if ( nodeScoreFunc ) {

			box1 = _box1$1;
			box2 = _box2$1;

			// bounding data is not offset
			arrayToBox( BOUNDING_DATA_INDEX( c1 ), float32Array, box1 );
			arrayToBox( BOUNDING_DATA_INDEX( c2 ), float32Array, box2 );

			score1 = nodeScoreFunc( box1 );
			score2 = nodeScoreFunc( box2 );

			if ( score2 < score1 ) {

				c1 = right;
				c2 = left;

				const temp = score1;
				score1 = score2;
				score2 = temp;

				box1 = box2;
				// box2 is always set before use below

			}

		}

		// Check box 1 intersection
		if ( ! box1 ) {

			box1 = _box1$1;
			arrayToBox( BOUNDING_DATA_INDEX( c1 ), float32Array, box1 );

		}

		const isC1Leaf = IS_LEAF( c1 * 2, uint16Array );
		const c1Intersection = intersectsBoundsFunc( box1, isC1Leaf, score1, depth + 1, nodeIndexByteOffset + c1 );

		let c1StopTraversal;
		if ( c1Intersection === CONTAINED ) {

			const offset = getLeftOffset( c1 );
			const end = getRightEndOffset( c1 );
			const count = end - offset;

			c1StopTraversal = intersectsRangeFunc( offset, count, true, depth + 1, nodeIndexByteOffset + c1, box1 );

		} else {

			c1StopTraversal =
				c1Intersection &&
				shapecastTraverse(
					c1,
					geometry,
					intersectsBoundsFunc,
					intersectsRangeFunc,
					nodeScoreFunc,
					nodeIndexByteOffset,
					depth + 1
				);

		}

		if ( c1StopTraversal ) return true;

		// Check box 2 intersection
		// cached box2 will have been overwritten by previous traversal
		box2 = _box2$1;
		arrayToBox( BOUNDING_DATA_INDEX( c2 ), float32Array, box2 );

		const isC2Leaf = IS_LEAF( c2 * 2, uint16Array );
		const c2Intersection = intersectsBoundsFunc( box2, isC2Leaf, score2, depth + 1, nodeIndexByteOffset + c2 );

		let c2StopTraversal;
		if ( c2Intersection === CONTAINED ) {

			const offset = getLeftOffset( c2 );
			const end = getRightEndOffset( c2 );
			const count = end - offset;

			c2StopTraversal = intersectsRangeFunc( offset, count, true, depth + 1, nodeIndexByteOffset + c2, box2 );

		} else {

			c2StopTraversal =
				c2Intersection &&
				shapecastTraverse(
					c2,
					geometry,
					intersectsBoundsFunc,
					intersectsRangeFunc,
					nodeScoreFunc,
					nodeIndexByteOffset,
					depth + 1
				);

		}

		if ( c2StopTraversal ) return true;

		return false;

		// Define these inside the function so it has access to the local variables needed
		// when converting to the buffer equivalents
		function getLeftOffset( nodeIndex32 ) {

			const { uint16Array, uint32Array } = BufferStack;
			let nodeIndex16 = nodeIndex32 * 2;

			// traverse until we find a leaf
			while ( ! IS_LEAF( nodeIndex16, uint16Array ) ) {

				nodeIndex32 = LEFT_NODE( nodeIndex32 );
				nodeIndex16 = nodeIndex32 * 2;

			}

			return OFFSET( nodeIndex32, uint32Array );

		}

		function getRightEndOffset( nodeIndex32 ) {

			const { uint16Array, uint32Array } = BufferStack;
			let nodeIndex16 = nodeIndex32 * 2;

			// traverse until we find a leaf
			while ( ! IS_LEAF( nodeIndex16, uint16Array ) ) {

				// adjust offset to point to the right node
				nodeIndex32 = RIGHT_NODE( nodeIndex32, uint32Array );
				nodeIndex16 = nodeIndex32 * 2;

			}

			// return the end offset of the triangle range
			return OFFSET( nodeIndex32, uint32Array ) + COUNT( nodeIndex16, uint16Array );

		}

	}

}

const temp = /* @__PURE__ */ new Vector3();
const temp1$2 = /* @__PURE__ */ new Vector3();

function closestPointToPoint(
	bvh,
	point,
	target = { },
	minThreshold = 0,
	maxThreshold = Infinity,
) {

	// early out if under minThreshold
	// skip checking if over maxThreshold
	// set minThreshold = maxThreshold to quickly check if a point is within a threshold
	// returns Infinity if no value found
	const minThresholdSq = minThreshold * minThreshold;
	const maxThresholdSq = maxThreshold * maxThreshold;
	let closestDistanceSq = Infinity;
	let closestDistanceTriIndex = null;
	bvh.shapecast(

		{

			boundsTraverseOrder: box => {

				temp.copy( point ).clamp( box.min, box.max );
				return temp.distanceToSquared( point );

			},

			intersectsBounds: ( box, isLeaf, score ) => {

				return score < closestDistanceSq && score < maxThresholdSq;

			},

			intersectsTriangle: ( tri, triIndex ) => {

				tri.closestPointToPoint( point, temp );
				const distSq = point.distanceToSquared( temp );
				if ( distSq < closestDistanceSq ) {

					temp1$2.copy( temp );
					closestDistanceSq = distSq;
					closestDistanceTriIndex = triIndex;

				}

				if ( distSq < minThresholdSq ) {

					return true;

				} else {

					return false;

				}

			},

		}

	);

	if ( closestDistanceSq === Infinity ) return null;

	const closestDistance = Math.sqrt( closestDistanceSq );

	if ( ! target.point ) target.point = temp1$2.clone();
	else target.point.copy( temp1$2 );
	target.distance = closestDistance,
	target.faceIndex = closestDistanceTriIndex;

	return target;

}

// Ripped and modified From THREE.js Mesh raycast
// https://github.com/mrdoob/three.js/blob/0aa87c999fe61e216c1133fba7a95772b503eddf/src/objects/Mesh.js#L115
const _vA = /* @__PURE__ */ new Vector3();
const _vB = /* @__PURE__ */ new Vector3();
const _vC = /* @__PURE__ */ new Vector3();

const _uvA = /* @__PURE__ */ new Vector2();
const _uvB = /* @__PURE__ */ new Vector2();
const _uvC = /* @__PURE__ */ new Vector2();

const _normalA = /* @__PURE__ */ new Vector3();
const _normalB = /* @__PURE__ */ new Vector3();
const _normalC = /* @__PURE__ */ new Vector3();

const _intersectionPoint = /* @__PURE__ */ new Vector3();
function checkIntersection( ray, pA, pB, pC, point, side, near, far ) {

	let intersect;
	if ( side === BackSide ) {

		intersect = ray.intersectTriangle( pC, pB, pA, true, point );

	} else {

		intersect = ray.intersectTriangle( pA, pB, pC, side !== DoubleSide, point );

	}

	if ( intersect === null ) return null;

	const distance = ray.origin.distanceTo( point );

	if ( distance < near || distance > far ) return null;

	return {

		distance: distance,
		point: point.clone(),

	};

}

function checkBufferGeometryIntersection( ray, position, normal, uv, uv1, a, b, c, side, near, far ) {

	_vA.fromBufferAttribute( position, a );
	_vB.fromBufferAttribute( position, b );
	_vC.fromBufferAttribute( position, c );

	const intersection = checkIntersection( ray, _vA, _vB, _vC, _intersectionPoint, side, near, far );

	if ( intersection ) {

		if ( uv ) {

			_uvA.fromBufferAttribute( uv, a );
			_uvB.fromBufferAttribute( uv, b );
			_uvC.fromBufferAttribute( uv, c );

			intersection.uv = Triangle.getInterpolation( _intersectionPoint, _vA, _vB, _vC, _uvA, _uvB, _uvC, new Vector2() );

		}

		if ( uv1 ) {

			_uvA.fromBufferAttribute( uv1, a );
			_uvB.fromBufferAttribute( uv1, b );
			_uvC.fromBufferAttribute( uv1, c );

			intersection.uv1 = Triangle.getInterpolation( _intersectionPoint, _vA, _vB, _vC, _uvA, _uvB, _uvC, new Vector2() );

		}

		if ( normal ) {

			_normalA.fromBufferAttribute( normal, a );
			_normalB.fromBufferAttribute( normal, b );
			_normalC.fromBufferAttribute( normal, c );

			intersection.normal = Triangle.getInterpolation( _intersectionPoint, _vA, _vB, _vC, _normalA, _normalB, _normalC, new Vector3() );
			if ( intersection.normal.dot( ray.direction ) > 0 ) {

				intersection.normal.multiplyScalar( - 1 );

			}

		}

		const face = {
			a: a,
			b: b,
			c: c,
			normal: new Vector3(),
			materialIndex: 0
		};

		Triangle.getNormal( _vA, _vB, _vC, face.normal );

		intersection.face = face;
		intersection.faceIndex = a;

	}

	return intersection;

}

// https://github.com/mrdoob/three.js/blob/0aa87c999fe61e216c1133fba7a95772b503eddf/src/objects/Mesh.js#L258
function intersectTri( geo, side, ray, tri, intersections, near, far ) {

	const triOffset = tri * 3;
	let a = triOffset + 0;
	let b = triOffset + 1;
	let c = triOffset + 2;

	const index = geo.index;
	if ( geo.index ) {

		a = index.getX( a );
		b = index.getX( b );
		c = index.getX( c );

	}

	const { position, normal, uv, uv1 } = geo.attributes;
	const intersection = checkBufferGeometryIntersection( ray, position, normal, uv, uv1, a, b, c, side, near, far );

	if ( intersection ) {

		intersection.faceIndex = tri;
		if ( intersections ) intersections.push( intersection );
		return intersection;

	}

	return null;

}

// sets the vertices of triangle `tri` with the 3 vertices after i
function setTriangle( tri, i, index, pos ) {

	const ta = tri.a;
	const tb = tri.b;
	const tc = tri.c;

	let i0 = i;
	let i1 = i + 1;
	let i2 = i + 2;
	if ( index ) {

		i0 = index.getX( i0 );
		i1 = index.getX( i1 );
		i2 = index.getX( i2 );

	}

	ta.x = pos.getX( i0 );
	ta.y = pos.getY( i0 );
	ta.z = pos.getZ( i0 );

	tb.x = pos.getX( i1 );
	tb.y = pos.getY( i1 );
	tb.z = pos.getZ( i1 );

	tc.x = pos.getX( i2 );
	tc.y = pos.getY( i2 );
	tc.z = pos.getZ( i2 );

}

const tempV1 = /* @__PURE__ */ new Vector3();
const tempV2 = /* @__PURE__ */ new Vector3();
const tempV3 = /* @__PURE__ */ new Vector3();
const tempUV1 = /* @__PURE__ */ new Vector2();
const tempUV2 = /* @__PURE__ */ new Vector2();
const tempUV3 = /* @__PURE__ */ new Vector2();

function getTriangleHitPointInfo( point, geometry, triangleIndex, target ) {

	const indices = geometry.getIndex().array;
	const positions = geometry.getAttribute( 'position' );
	const uvs = geometry.getAttribute( 'uv' );

	const a = indices[ triangleIndex * 3 ];
	const b = indices[ triangleIndex * 3 + 1 ];
	const c = indices[ triangleIndex * 3 + 2 ];

	tempV1.fromBufferAttribute( positions, a );
	tempV2.fromBufferAttribute( positions, b );
	tempV3.fromBufferAttribute( positions, c );

	// find the associated material index
	let materialIndex = 0;
	const groups = geometry.groups;
	const firstVertexIndex = triangleIndex * 3;
	for ( let i = 0, l = groups.length; i < l; i ++ ) {

		const group = groups[ i ];
		const { start, count } = group;
		if ( firstVertexIndex >= start && firstVertexIndex < start + count ) {

			materialIndex = group.materialIndex;
			break;

		}

	}

	// extract uvs
	let uv = null;
	if ( uvs ) {

		tempUV1.fromBufferAttribute( uvs, a );
		tempUV2.fromBufferAttribute( uvs, b );
		tempUV3.fromBufferAttribute( uvs, c );

		if ( target && target.uv ) uv = target.uv;
		else uv = new Vector2();

		Triangle.getInterpolation( point, tempV1, tempV2, tempV3, tempUV1, tempUV2, tempUV3, uv );

	}

	// adjust the provided target or create a new one
	if ( target ) {

		if ( ! target.face ) target.face = { };
		target.face.a = a;
		target.face.b = b;
		target.face.c = c;
		target.face.materialIndex = materialIndex;
		if ( ! target.face.normal ) target.face.normal = new Vector3();
		Triangle.getNormal( tempV1, tempV2, tempV3, target.face.normal );

		if ( uv ) target.uv = uv;

		return target;

	} else {

		return {
			face: {
				a: a,
				b: b,
				c: c,
				materialIndex: materialIndex,
				normal: Triangle.getNormal( tempV1, tempV2, tempV3, new Vector3() )
			},
			uv: uv
		};

	}

}

/*************************************************************/
/* This file is generated from "iterationUtils.template.js". */
/*************************************************************/
/* eslint-disable indent */

function intersectTris( bvh, side, ray, offset, count, intersections, near, far ) {

	const { geometry, _indirectBuffer } = bvh;
	for ( let i = offset, end = offset + count; i < end; i ++ ) {


		intersectTri( geometry, side, ray, i, intersections, near, far );


	}

}

function intersectClosestTri( bvh, side, ray, offset, count, near, far ) {

	const { geometry, _indirectBuffer } = bvh;
	let dist = Infinity;
	let res = null;
	for ( let i = offset, end = offset + count; i < end; i ++ ) {

		let intersection;

		intersection = intersectTri( geometry, side, ray, i, null, near, far );


		if ( intersection && intersection.distance < dist ) {

			res = intersection;
			dist = intersection.distance;

		}

	}

	return res;

}

function iterateOverTriangles(
	offset,
	count,
	bvh,
	intersectsTriangleFunc,
	contained,
	depth,
	triangle
) {

	const { geometry } = bvh;
	const { index } = geometry;
	const pos = geometry.attributes.position;
	for ( let i = offset, l = count + offset; i < l; i ++ ) {

		let tri;

		tri = i;

		setTriangle( triangle, tri * 3, index, pos );
		triangle.needsUpdate = true;

		if ( intersectsTriangleFunc( triangle, tri, contained, depth ) ) {

			return true;

		}

	}

	return false;

}

/****************************************************/
/* This file is generated from "refit.template.js". */
/****************************************************/

function refit( bvh, nodeIndices = null ) {

	if ( nodeIndices && Array.isArray( nodeIndices ) ) {

		nodeIndices = new Set( nodeIndices );

	}

	const geometry = bvh.geometry;
	const indexArr = geometry.index ? geometry.index.array : null;
	const posAttr = geometry.attributes.position;

	let buffer, uint32Array, uint16Array, float32Array;
	let byteOffset = 0;
	const roots = bvh._roots;
	for ( let i = 0, l = roots.length; i < l; i ++ ) {

		buffer = roots[ i ];
		uint32Array = new Uint32Array( buffer );
		uint16Array = new Uint16Array( buffer );
		float32Array = new Float32Array( buffer );

		_traverse( 0, byteOffset );
		byteOffset += buffer.byteLength;

	}

	function _traverse( node32Index, byteOffset, force = false ) {

		const node16Index = node32Index * 2;
		const isLeaf = uint16Array[ node16Index + 15 ] === IS_LEAFNODE_FLAG;
		if ( isLeaf ) {

			const offset = uint32Array[ node32Index + 6 ];
			const count = uint16Array[ node16Index + 14 ];

			let minx = Infinity;
			let miny = Infinity;
			let minz = Infinity;
			let maxx = - Infinity;
			let maxy = - Infinity;
			let maxz = - Infinity;


			for ( let i = 3 * offset, l = 3 * ( offset + count ); i < l; i ++ ) {

				let index = indexArr[ i ];
				const x = posAttr.getX( index );
				const y = posAttr.getY( index );
				const z = posAttr.getZ( index );

				if ( x < minx ) minx = x;
				if ( x > maxx ) maxx = x;

				if ( y < miny ) miny = y;
				if ( y > maxy ) maxy = y;

				if ( z < minz ) minz = z;
				if ( z > maxz ) maxz = z;

			}


			if (
				float32Array[ node32Index + 0 ] !== minx ||
				float32Array[ node32Index + 1 ] !== miny ||
				float32Array[ node32Index + 2 ] !== minz ||

				float32Array[ node32Index + 3 ] !== maxx ||
				float32Array[ node32Index + 4 ] !== maxy ||
				float32Array[ node32Index + 5 ] !== maxz
			) {

				float32Array[ node32Index + 0 ] = minx;
				float32Array[ node32Index + 1 ] = miny;
				float32Array[ node32Index + 2 ] = minz;

				float32Array[ node32Index + 3 ] = maxx;
				float32Array[ node32Index + 4 ] = maxy;
				float32Array[ node32Index + 5 ] = maxz;

				return true;

			} else {

				return false;

			}

		} else {

			const left = node32Index + 8;
			const right = uint32Array[ node32Index + 6 ];

			// the identifying node indices provided by the shapecast function include offsets of all
			// root buffers to guarantee they're unique between roots so offset left and right indices here.
			const offsetLeft = left + byteOffset;
			const offsetRight = right + byteOffset;
			let forceChildren = force;
			let includesLeft = false;
			let includesRight = false;

			if ( nodeIndices ) {

				// if we see that neither the left or right child are included in the set that need to be updated
				// then we assume that all children need to be updated.
				if ( ! forceChildren ) {

					includesLeft = nodeIndices.has( offsetLeft );
					includesRight = nodeIndices.has( offsetRight );
					forceChildren = ! includesLeft && ! includesRight;

				}

			} else {

				includesLeft = true;
				includesRight = true;

			}

			const traverseLeft = forceChildren || includesLeft;
			const traverseRight = forceChildren || includesRight;

			let leftChange = false;
			if ( traverseLeft ) {

				leftChange = _traverse( left, byteOffset, forceChildren );

			}

			let rightChange = false;
			if ( traverseRight ) {

				rightChange = _traverse( right, byteOffset, forceChildren );

			}

			const didChange = leftChange || rightChange;
			if ( didChange ) {

				for ( let i = 0; i < 3; i ++ ) {

					const lefti = left + i;
					const righti = right + i;
					const minLeftValue = float32Array[ lefti ];
					const maxLeftValue = float32Array[ lefti + 3 ];
					const minRightValue = float32Array[ righti ];
					const maxRightValue = float32Array[ righti + 3 ];

					float32Array[ node32Index + i ] = minLeftValue < minRightValue ? minLeftValue : minRightValue;
					float32Array[ node32Index + i + 3 ] = maxLeftValue > maxRightValue ? maxLeftValue : maxRightValue;

				}

			}

			return didChange;

		}

	}

}

/**
 * This function performs intersection tests similar to Ray.intersectBox in three.js,
 * with the difference that the box values are read from an array to improve performance.
 */
function intersectRay( nodeIndex32, array, ray, near, far ) {

	let tmin, tmax, tymin, tymax, tzmin, tzmax;

	const invdirx = 1 / ray.direction.x,
		invdiry = 1 / ray.direction.y,
		invdirz = 1 / ray.direction.z;

	const ox = ray.origin.x;
	const oy = ray.origin.y;
	const oz = ray.origin.z;

	let minx = array[ nodeIndex32 ];
	let maxx = array[ nodeIndex32 + 3 ];

	let miny = array[ nodeIndex32 + 1 ];
	let maxy = array[ nodeIndex32 + 3 + 1 ];

	let minz = array[ nodeIndex32 + 2 ];
	let maxz = array[ nodeIndex32 + 3 + 2 ];

	if ( invdirx >= 0 ) {

		tmin = ( minx - ox ) * invdirx;
		tmax = ( maxx - ox ) * invdirx;

	} else {

		tmin = ( maxx - ox ) * invdirx;
		tmax = ( minx - ox ) * invdirx;

	}

	if ( invdiry >= 0 ) {

		tymin = ( miny - oy ) * invdiry;
		tymax = ( maxy - oy ) * invdiry;

	} else {

		tymin = ( maxy - oy ) * invdiry;
		tymax = ( miny - oy ) * invdiry;

	}

	if ( ( tmin > tymax ) || ( tymin > tmax ) ) return false;

	if ( tymin > tmin || isNaN( tmin ) ) tmin = tymin;

	if ( tymax < tmax || isNaN( tmax ) ) tmax = tymax;

	if ( invdirz >= 0 ) {

		tzmin = ( minz - oz ) * invdirz;
		tzmax = ( maxz - oz ) * invdirz;

	} else {

		tzmin = ( maxz - oz ) * invdirz;
		tzmax = ( minz - oz ) * invdirz;

	}

	if ( ( tmin > tzmax ) || ( tzmin > tmax ) ) return false;

	if ( tzmin > tmin || tmin !== tmin ) tmin = tzmin;

	if ( tzmax < tmax || tmax !== tmax ) tmax = tzmax;

	//return point closest to the ray (positive side)

	return tmin <= far && tmax >= near;

}

/*************************************************************/
/* This file is generated from "iterationUtils.template.js". */
/*************************************************************/
/* eslint-disable indent */

function intersectTris_indirect( bvh, side, ray, offset, count, intersections, near, far ) {

	const { geometry, _indirectBuffer } = bvh;
	for ( let i = offset, end = offset + count; i < end; i ++ ) {

		let vi = _indirectBuffer ? _indirectBuffer[ i ] : i;
		intersectTri( geometry, side, ray, vi, intersections, near, far );


	}

}

function intersectClosestTri_indirect( bvh, side, ray, offset, count, near, far ) {

	const { geometry, _indirectBuffer } = bvh;
	let dist = Infinity;
	let res = null;
	for ( let i = offset, end = offset + count; i < end; i ++ ) {

		let intersection;
		intersection = intersectTri( geometry, side, ray, _indirectBuffer ? _indirectBuffer[ i ] : i, null, near, far );


		if ( intersection && intersection.distance < dist ) {

			res = intersection;
			dist = intersection.distance;

		}

	}

	return res;

}

function iterateOverTriangles_indirect(
	offset,
	count,
	bvh,
	intersectsTriangleFunc,
	contained,
	depth,
	triangle
) {

	const { geometry } = bvh;
	const { index } = geometry;
	const pos = geometry.attributes.position;
	for ( let i = offset, l = count + offset; i < l; i ++ ) {

		let tri;
		tri = bvh.resolveTriangleIndex( i );

		setTriangle( triangle, tri * 3, index, pos );
		triangle.needsUpdate = true;

		if ( intersectsTriangleFunc( triangle, tri, contained, depth ) ) {

			return true;

		}

	}

	return false;

}

/******************************************************/
/* This file is generated from "raycast.template.js". */
/******************************************************/

function raycast( bvh, root, side, ray, intersects, near, far ) {

	BufferStack.setBuffer( bvh._roots[ root ] );
	_raycast$1( 0, bvh, side, ray, intersects, near, far );
	BufferStack.clearBuffer();

}

function _raycast$1( nodeIndex32, bvh, side, ray, intersects, near, far ) {

	const { float32Array, uint16Array, uint32Array } = BufferStack;
	const nodeIndex16 = nodeIndex32 * 2;
	const isLeaf = IS_LEAF( nodeIndex16, uint16Array );
	if ( isLeaf ) {

		const offset = OFFSET( nodeIndex32, uint32Array );
		const count = COUNT( nodeIndex16, uint16Array );


		intersectTris( bvh, side, ray, offset, count, intersects, near, far );


	} else {

		const leftIndex = LEFT_NODE( nodeIndex32 );
		if ( intersectRay( leftIndex, float32Array, ray, near, far ) ) {

			_raycast$1( leftIndex, bvh, side, ray, intersects, near, far );

		}

		const rightIndex = RIGHT_NODE( nodeIndex32, uint32Array );
		if ( intersectRay( rightIndex, float32Array, ray, near, far ) ) {

			_raycast$1( rightIndex, bvh, side, ray, intersects, near, far );

		}

	}

}

/***********************************************************/
/* This file is generated from "raycastFirst.template.js". */
/***********************************************************/

const _xyzFields$1 = [ 'x', 'y', 'z' ];

function raycastFirst( bvh, root, side, ray, near, far ) {

	BufferStack.setBuffer( bvh._roots[ root ] );
	const result = _raycastFirst$1( 0, bvh, side, ray, near, far );
	BufferStack.clearBuffer();

	return result;

}

function _raycastFirst$1( nodeIndex32, bvh, side, ray, near, far ) {

	const { float32Array, uint16Array, uint32Array } = BufferStack;
	let nodeIndex16 = nodeIndex32 * 2;

	const isLeaf = IS_LEAF( nodeIndex16, uint16Array );
	if ( isLeaf ) {

		const offset = OFFSET( nodeIndex32, uint32Array );
		const count = COUNT( nodeIndex16, uint16Array );


		// eslint-disable-next-line no-unreachable
		return intersectClosestTri( bvh, side, ray, offset, count, near, far );


	} else {

		// consider the position of the split plane with respect to the oncoming ray; whichever direction
		// the ray is coming from, look for an intersection among that side of the tree first
		const splitAxis = SPLIT_AXIS( nodeIndex32, uint32Array );
		const xyzAxis = _xyzFields$1[ splitAxis ];
		const rayDir = ray.direction[ xyzAxis ];
		const leftToRight = rayDir >= 0;

		// c1 is the child to check first
		let c1, c2;
		if ( leftToRight ) {

			c1 = LEFT_NODE( nodeIndex32 );
			c2 = RIGHT_NODE( nodeIndex32, uint32Array );

		} else {

			c1 = RIGHT_NODE( nodeIndex32, uint32Array );
			c2 = LEFT_NODE( nodeIndex32 );

		}

		const c1Intersection = intersectRay( c1, float32Array, ray, near, far );
		const c1Result = c1Intersection ? _raycastFirst$1( c1, bvh, side, ray, near, far ) : null;

		// if we got an intersection in the first node and it's closer than the second node's bounding
		// box, we don't need to consider the second node because it couldn't possibly be a better result
		if ( c1Result ) {

			// check if the point is within the second bounds
			// "point" is in the local frame of the bvh
			const point = c1Result.point[ xyzAxis ];
			const isOutside = leftToRight ?
				point <= float32Array[ c2 + splitAxis ] : // min bounding data
				point >= float32Array[ c2 + splitAxis + 3 ]; // max bounding data

			if ( isOutside ) {

				return c1Result;

			}

		}

		// either there was no intersection in the first node, or there could still be a closer
		// intersection in the second, so check the second node and then take the better of the two
		const c2Intersection = intersectRay( c2, float32Array, ray, near, far );
		const c2Result = c2Intersection ? _raycastFirst$1( c2, bvh, side, ray, near, far ) : null;

		if ( c1Result && c2Result ) {

			return c1Result.distance <= c2Result.distance ? c1Result : c2Result;

		} else {

			return c1Result || c2Result || null;

		}

	}

}

/*****************************************************************/
/* This file is generated from "intersectsGeometry.template.js". */
/*****************************************************************/
/* eslint-disable indent */

const boundingBox$2 = /* @__PURE__ */ new Box3();
const triangle$1 = /* @__PURE__ */ new ExtendedTriangle();
const triangle2$1 = /* @__PURE__ */ new ExtendedTriangle();
const invertedMat$1 = /* @__PURE__ */ new Matrix4();

const obb$4 = /* @__PURE__ */ new OrientedBox();
const obb2$3 = /* @__PURE__ */ new OrientedBox();

function intersectsGeometry( bvh, root, otherGeometry, geometryToBvh ) {

	BufferStack.setBuffer( bvh._roots[ root ] );
	const result = _intersectsGeometry$1( 0, bvh, otherGeometry, geometryToBvh );
	BufferStack.clearBuffer();

	return result;

}

function _intersectsGeometry$1( nodeIndex32, bvh, otherGeometry, geometryToBvh, cachedObb = null ) {

	const { float32Array, uint16Array, uint32Array } = BufferStack;
	let nodeIndex16 = nodeIndex32 * 2;

	if ( cachedObb === null ) {

		if ( ! otherGeometry.boundingBox ) {

			otherGeometry.computeBoundingBox();

		}

		obb$4.set( otherGeometry.boundingBox.min, otherGeometry.boundingBox.max, geometryToBvh );
		cachedObb = obb$4;

	}

	const isLeaf = IS_LEAF( nodeIndex16, uint16Array );
	if ( isLeaf ) {

		const thisGeometry = bvh.geometry;
		const thisIndex = thisGeometry.index;
		const thisPos = thisGeometry.attributes.position;

		const index = otherGeometry.index;
		const pos = otherGeometry.attributes.position;

		const offset = OFFSET( nodeIndex32, uint32Array );
		const count = COUNT( nodeIndex16, uint16Array );

		// get the inverse of the geometry matrix so we can transform our triangles into the
		// geometry space we're trying to test. We assume there are fewer triangles being checked
		// here.
		invertedMat$1.copy( geometryToBvh ).invert();

		if ( otherGeometry.boundsTree ) {

			// if there's a bounds tree
			arrayToBox( BOUNDING_DATA_INDEX( nodeIndex32 ), float32Array, obb2$3 );
			obb2$3.matrix.copy( invertedMat$1 );
			obb2$3.needsUpdate = true;

			// TODO: use a triangle iteration function here
			const res = otherGeometry.boundsTree.shapecast( {

				intersectsBounds: box => obb2$3.intersectsBox( box ),

				intersectsTriangle: tri => {

					tri.a.applyMatrix4( geometryToBvh );
					tri.b.applyMatrix4( geometryToBvh );
					tri.c.applyMatrix4( geometryToBvh );
					tri.needsUpdate = true;


					for ( let i = offset * 3, l = ( count + offset ) * 3; i < l; i += 3 ) {

						// this triangle needs to be transformed into the current BVH coordinate frame
						setTriangle( triangle2$1, i, thisIndex, thisPos );
						triangle2$1.needsUpdate = true;
						if ( tri.intersectsTriangle( triangle2$1 ) ) {

							return true;

						}

					}


					return false;

				}

			} );

			return res;

		} else {

			// if we're just dealing with raw geometry

			for ( let i = offset * 3, l = ( count + offset ) * 3; i < l; i += 3 ) {

				// this triangle needs to be transformed into the current BVH coordinate frame
				setTriangle( triangle$1, i, thisIndex, thisPos );


				triangle$1.a.applyMatrix4( invertedMat$1 );
				triangle$1.b.applyMatrix4( invertedMat$1 );
				triangle$1.c.applyMatrix4( invertedMat$1 );
				triangle$1.needsUpdate = true;

				for ( let i2 = 0, l2 = index.count; i2 < l2; i2 += 3 ) {

					setTriangle( triangle2$1, i2, index, pos );
					triangle2$1.needsUpdate = true;

					if ( triangle$1.intersectsTriangle( triangle2$1 ) ) {

						return true;

					}

				}


			}


		}

	} else {

		const left = nodeIndex32 + 8;
		const right = uint32Array[ nodeIndex32 + 6 ];

		arrayToBox( BOUNDING_DATA_INDEX( left ), float32Array, boundingBox$2 );
		const leftIntersection =
			cachedObb.intersectsBox( boundingBox$2 ) &&
			_intersectsGeometry$1( left, bvh, otherGeometry, geometryToBvh, cachedObb );

		if ( leftIntersection ) return true;

		arrayToBox( BOUNDING_DATA_INDEX( right ), float32Array, boundingBox$2 );
		const rightIntersection =
			cachedObb.intersectsBox( boundingBox$2 ) &&
			_intersectsGeometry$1( right, bvh, otherGeometry, geometryToBvh, cachedObb );

		if ( rightIntersection ) return true;

		return false;

	}

}

/*********************************************************************/
/* This file is generated from "closestPointToGeometry.template.js". */
/*********************************************************************/

const tempMatrix$1 = /* @__PURE__ */ new Matrix4();
const obb$3 = /* @__PURE__ */ new OrientedBox();
const obb2$2 = /* @__PURE__ */ new OrientedBox();
const temp1$1 = /* @__PURE__ */ new Vector3();
const temp2$1 = /* @__PURE__ */ new Vector3();
const temp3$1 = /* @__PURE__ */ new Vector3();
const temp4$1 = /* @__PURE__ */ new Vector3();

function closestPointToGeometry(
	bvh,
	otherGeometry,
	geometryToBvh,
	target1 = { },
	target2 = { },
	minThreshold = 0,
	maxThreshold = Infinity,
) {

	if ( ! otherGeometry.boundingBox ) {

		otherGeometry.computeBoundingBox();

	}

	obb$3.set( otherGeometry.boundingBox.min, otherGeometry.boundingBox.max, geometryToBvh );
	obb$3.needsUpdate = true;

	const geometry = bvh.geometry;
	const pos = geometry.attributes.position;
	const index = geometry.index;
	const otherPos = otherGeometry.attributes.position;
	const otherIndex = otherGeometry.index;
	const triangle = ExtendedTrianglePool.getPrimitive();
	const triangle2 = ExtendedTrianglePool.getPrimitive();

	let tempTarget1 = temp1$1;
	let tempTargetDest1 = temp2$1;
	let tempTarget2 = null;
	let tempTargetDest2 = null;

	if ( target2 ) {

		tempTarget2 = temp3$1;
		tempTargetDest2 = temp4$1;

	}

	let closestDistance = Infinity;
	let closestDistanceTriIndex = null;
	let closestDistanceOtherTriIndex = null;
	tempMatrix$1.copy( geometryToBvh ).invert();
	obb2$2.matrix.copy( tempMatrix$1 );
	bvh.shapecast(
		{

			boundsTraverseOrder: box => {

				return obb$3.distanceToBox( box );

			},

			intersectsBounds: ( box, isLeaf, score ) => {

				if ( score < closestDistance && score < maxThreshold ) {

					// if we know the triangles of this bounds will be intersected next then
					// save the bounds to use during triangle checks.
					if ( isLeaf ) {

						obb2$2.min.copy( box.min );
						obb2$2.max.copy( box.max );
						obb2$2.needsUpdate = true;

					}

					return true;

				}

				return false;

			},

			intersectsRange: ( offset, count ) => {

				if ( otherGeometry.boundsTree ) {

					// if the other geometry has a bvh then use the accelerated path where we use shapecast to find
					// the closest bounds in the other geometry to check.
					const otherBvh = otherGeometry.boundsTree;
					return otherBvh.shapecast( {
						boundsTraverseOrder: box => {

							return obb2$2.distanceToBox( box );

						},

						intersectsBounds: ( box, isLeaf, score ) => {

							return score < closestDistance && score < maxThreshold;

						},

						intersectsRange: ( otherOffset, otherCount ) => {

							for ( let i2 = otherOffset, l2 = otherOffset + otherCount; i2 < l2; i2 ++ ) {


								setTriangle( triangle2, 3 * i2, otherIndex, otherPos );

								triangle2.a.applyMatrix4( geometryToBvh );
								triangle2.b.applyMatrix4( geometryToBvh );
								triangle2.c.applyMatrix4( geometryToBvh );
								triangle2.needsUpdate = true;

								for ( let i = offset, l = offset + count; i < l; i ++ ) {


									setTriangle( triangle, 3 * i, index, pos );

									triangle.needsUpdate = true;

									const dist = triangle.distanceToTriangle( triangle2, tempTarget1, tempTarget2 );
									if ( dist < closestDistance ) {

										tempTargetDest1.copy( tempTarget1 );

										if ( tempTargetDest2 ) {

											tempTargetDest2.copy( tempTarget2 );

										}

										closestDistance = dist;
										closestDistanceTriIndex = i;
										closestDistanceOtherTriIndex = i2;

									}

									// stop traversal if we find a point that's under the given threshold
									if ( dist < minThreshold ) {

										return true;

									}

								}

							}

						},
					} );

				} else {

					// If no bounds tree then we'll just check every triangle.
					const triCount = getTriCount( otherGeometry );
					for ( let i2 = 0, l2 = triCount; i2 < l2; i2 ++ ) {

						setTriangle( triangle2, 3 * i2, otherIndex, otherPos );
						triangle2.a.applyMatrix4( geometryToBvh );
						triangle2.b.applyMatrix4( geometryToBvh );
						triangle2.c.applyMatrix4( geometryToBvh );
						triangle2.needsUpdate = true;

						for ( let i = offset, l = offset + count; i < l; i ++ ) {


							setTriangle( triangle, 3 * i, index, pos );

							triangle.needsUpdate = true;

							const dist = triangle.distanceToTriangle( triangle2, tempTarget1, tempTarget2 );
							if ( dist < closestDistance ) {

								tempTargetDest1.copy( tempTarget1 );

								if ( tempTargetDest2 ) {

									tempTargetDest2.copy( tempTarget2 );

								}

								closestDistance = dist;
								closestDistanceTriIndex = i;
								closestDistanceOtherTriIndex = i2;

							}

							// stop traversal if we find a point that's under the given threshold
							if ( dist < minThreshold ) {

								return true;

							}

						}

					}

				}

			},

		}

	);

	ExtendedTrianglePool.releasePrimitive( triangle );
	ExtendedTrianglePool.releasePrimitive( triangle2 );

	if ( closestDistance === Infinity ) {

		return null;

	}

	if ( ! target1.point ) {

		target1.point = tempTargetDest1.clone();

	} else {

		target1.point.copy( tempTargetDest1 );

	}

	target1.distance = closestDistance,
	target1.faceIndex = closestDistanceTriIndex;

	if ( target2 ) {

		if ( ! target2.point ) target2.point = tempTargetDest2.clone();
		else target2.point.copy( tempTargetDest2 );
		target2.point.applyMatrix4( tempMatrix$1 );
		tempTargetDest1.applyMatrix4( tempMatrix$1 );
		target2.distance = tempTargetDest1.sub( target2.point ).length();
		target2.faceIndex = closestDistanceOtherTriIndex;

	}

	return target1;

}

/****************************************************/
/* This file is generated from "refit.template.js". */
/****************************************************/

function refit_indirect( bvh, nodeIndices = null ) {

	if ( nodeIndices && Array.isArray( nodeIndices ) ) {

		nodeIndices = new Set( nodeIndices );

	}

	const geometry = bvh.geometry;
	const indexArr = geometry.index ? geometry.index.array : null;
	const posAttr = geometry.attributes.position;

	let buffer, uint32Array, uint16Array, float32Array;
	let byteOffset = 0;
	const roots = bvh._roots;
	for ( let i = 0, l = roots.length; i < l; i ++ ) {

		buffer = roots[ i ];
		uint32Array = new Uint32Array( buffer );
		uint16Array = new Uint16Array( buffer );
		float32Array = new Float32Array( buffer );

		_traverse( 0, byteOffset );
		byteOffset += buffer.byteLength;

	}

	function _traverse( node32Index, byteOffset, force = false ) {

		const node16Index = node32Index * 2;
		const isLeaf = uint16Array[ node16Index + 15 ] === IS_LEAFNODE_FLAG;
		if ( isLeaf ) {

			const offset = uint32Array[ node32Index + 6 ];
			const count = uint16Array[ node16Index + 14 ];

			let minx = Infinity;
			let miny = Infinity;
			let minz = Infinity;
			let maxx = - Infinity;
			let maxy = - Infinity;
			let maxz = - Infinity;

			for ( let i = offset, l = offset + count; i < l; i ++ ) {

				const t = 3 * bvh.resolveTriangleIndex( i );
				for ( let j = 0; j < 3; j ++ ) {

					let index = t + j;
					index = indexArr ? indexArr[ index ] : index;

					const x = posAttr.getX( index );
					const y = posAttr.getY( index );
					const z = posAttr.getZ( index );

					if ( x < minx ) minx = x;
					if ( x > maxx ) maxx = x;

					if ( y < miny ) miny = y;
					if ( y > maxy ) maxy = y;

					if ( z < minz ) minz = z;
					if ( z > maxz ) maxz = z;


				}

			}


			if (
				float32Array[ node32Index + 0 ] !== minx ||
				float32Array[ node32Index + 1 ] !== miny ||
				float32Array[ node32Index + 2 ] !== minz ||

				float32Array[ node32Index + 3 ] !== maxx ||
				float32Array[ node32Index + 4 ] !== maxy ||
				float32Array[ node32Index + 5 ] !== maxz
			) {

				float32Array[ node32Index + 0 ] = minx;
				float32Array[ node32Index + 1 ] = miny;
				float32Array[ node32Index + 2 ] = minz;

				float32Array[ node32Index + 3 ] = maxx;
				float32Array[ node32Index + 4 ] = maxy;
				float32Array[ node32Index + 5 ] = maxz;

				return true;

			} else {

				return false;

			}

		} else {

			const left = node32Index + 8;
			const right = uint32Array[ node32Index + 6 ];

			// the identifying node indices provided by the shapecast function include offsets of all
			// root buffers to guarantee they're unique between roots so offset left and right indices here.
			const offsetLeft = left + byteOffset;
			const offsetRight = right + byteOffset;
			let forceChildren = force;
			let includesLeft = false;
			let includesRight = false;

			if ( nodeIndices ) {

				// if we see that neither the left or right child are included in the set that need to be updated
				// then we assume that all children need to be updated.
				if ( ! forceChildren ) {

					includesLeft = nodeIndices.has( offsetLeft );
					includesRight = nodeIndices.has( offsetRight );
					forceChildren = ! includesLeft && ! includesRight;

				}

			} else {

				includesLeft = true;
				includesRight = true;

			}

			const traverseLeft = forceChildren || includesLeft;
			const traverseRight = forceChildren || includesRight;

			let leftChange = false;
			if ( traverseLeft ) {

				leftChange = _traverse( left, byteOffset, forceChildren );

			}

			let rightChange = false;
			if ( traverseRight ) {

				rightChange = _traverse( right, byteOffset, forceChildren );

			}

			const didChange = leftChange || rightChange;
			if ( didChange ) {

				for ( let i = 0; i < 3; i ++ ) {

					const lefti = left + i;
					const righti = right + i;
					const minLeftValue = float32Array[ lefti ];
					const maxLeftValue = float32Array[ lefti + 3 ];
					const minRightValue = float32Array[ righti ];
					const maxRightValue = float32Array[ righti + 3 ];

					float32Array[ node32Index + i ] = minLeftValue < minRightValue ? minLeftValue : minRightValue;
					float32Array[ node32Index + i + 3 ] = maxLeftValue > maxRightValue ? maxLeftValue : maxRightValue;

				}

			}

			return didChange;

		}

	}

}

/******************************************************/
/* This file is generated from "raycast.template.js". */
/******************************************************/

function raycast_indirect( bvh, root, side, ray, intersects, near, far ) {

	BufferStack.setBuffer( bvh._roots[ root ] );
	_raycast( 0, bvh, side, ray, intersects, near, far );
	BufferStack.clearBuffer();

}

function _raycast( nodeIndex32, bvh, side, ray, intersects, near, far ) {

	const { float32Array, uint16Array, uint32Array } = BufferStack;
	const nodeIndex16 = nodeIndex32 * 2;
	const isLeaf = IS_LEAF( nodeIndex16, uint16Array );
	if ( isLeaf ) {

		const offset = OFFSET( nodeIndex32, uint32Array );
		const count = COUNT( nodeIndex16, uint16Array );

		intersectTris_indirect( bvh, side, ray, offset, count, intersects, near, far );


	} else {

		const leftIndex = LEFT_NODE( nodeIndex32 );
		if ( intersectRay( leftIndex, float32Array, ray, near, far ) ) {

			_raycast( leftIndex, bvh, side, ray, intersects, near, far );

		}

		const rightIndex = RIGHT_NODE( nodeIndex32, uint32Array );
		if ( intersectRay( rightIndex, float32Array, ray, near, far ) ) {

			_raycast( rightIndex, bvh, side, ray, intersects, near, far );

		}

	}

}

/***********************************************************/
/* This file is generated from "raycastFirst.template.js". */
/***********************************************************/

const _xyzFields = [ 'x', 'y', 'z' ];

function raycastFirst_indirect( bvh, root, side, ray, near, far ) {

	BufferStack.setBuffer( bvh._roots[ root ] );
	const result = _raycastFirst( 0, bvh, side, ray, near, far );
	BufferStack.clearBuffer();

	return result;

}

function _raycastFirst( nodeIndex32, bvh, side, ray, near, far ) {

	const { float32Array, uint16Array, uint32Array } = BufferStack;
	let nodeIndex16 = nodeIndex32 * 2;

	const isLeaf = IS_LEAF( nodeIndex16, uint16Array );
	if ( isLeaf ) {

		const offset = OFFSET( nodeIndex32, uint32Array );
		const count = COUNT( nodeIndex16, uint16Array );

		return intersectClosestTri_indirect( bvh, side, ray, offset, count, near, far );


	} else {

		// consider the position of the split plane with respect to the oncoming ray; whichever direction
		// the ray is coming from, look for an intersection among that side of the tree first
		const splitAxis = SPLIT_AXIS( nodeIndex32, uint32Array );
		const xyzAxis = _xyzFields[ splitAxis ];
		const rayDir = ray.direction[ xyzAxis ];
		const leftToRight = rayDir >= 0;

		// c1 is the child to check first
		let c1, c2;
		if ( leftToRight ) {

			c1 = LEFT_NODE( nodeIndex32 );
			c2 = RIGHT_NODE( nodeIndex32, uint32Array );

		} else {

			c1 = RIGHT_NODE( nodeIndex32, uint32Array );
			c2 = LEFT_NODE( nodeIndex32 );

		}

		const c1Intersection = intersectRay( c1, float32Array, ray, near, far );
		const c1Result = c1Intersection ? _raycastFirst( c1, bvh, side, ray, near, far ) : null;

		// if we got an intersection in the first node and it's closer than the second node's bounding
		// box, we don't need to consider the second node because it couldn't possibly be a better result
		if ( c1Result ) {

			// check if the point is within the second bounds
			// "point" is in the local frame of the bvh
			const point = c1Result.point[ xyzAxis ];
			const isOutside = leftToRight ?
				point <= float32Array[ c2 + splitAxis ] : // min bounding data
				point >= float32Array[ c2 + splitAxis + 3 ]; // max bounding data

			if ( isOutside ) {

				return c1Result;

			}

		}

		// either there was no intersection in the first node, or there could still be a closer
		// intersection in the second, so check the second node and then take the better of the two
		const c2Intersection = intersectRay( c2, float32Array, ray, near, far );
		const c2Result = c2Intersection ? _raycastFirst( c2, bvh, side, ray, near, far ) : null;

		if ( c1Result && c2Result ) {

			return c1Result.distance <= c2Result.distance ? c1Result : c2Result;

		} else {

			return c1Result || c2Result || null;

		}

	}

}

/*****************************************************************/
/* This file is generated from "intersectsGeometry.template.js". */
/*****************************************************************/
/* eslint-disable indent */

const boundingBox$1 = /* @__PURE__ */ new Box3();
const triangle = /* @__PURE__ */ new ExtendedTriangle();
const triangle2 = /* @__PURE__ */ new ExtendedTriangle();
const invertedMat = /* @__PURE__ */ new Matrix4();

const obb$2 = /* @__PURE__ */ new OrientedBox();
const obb2$1 = /* @__PURE__ */ new OrientedBox();

function intersectsGeometry_indirect( bvh, root, otherGeometry, geometryToBvh ) {

	BufferStack.setBuffer( bvh._roots[ root ] );
	const result = _intersectsGeometry( 0, bvh, otherGeometry, geometryToBvh );
	BufferStack.clearBuffer();

	return result;

}

function _intersectsGeometry( nodeIndex32, bvh, otherGeometry, geometryToBvh, cachedObb = null ) {

	const { float32Array, uint16Array, uint32Array } = BufferStack;
	let nodeIndex16 = nodeIndex32 * 2;

	if ( cachedObb === null ) {

		if ( ! otherGeometry.boundingBox ) {

			otherGeometry.computeBoundingBox();

		}

		obb$2.set( otherGeometry.boundingBox.min, otherGeometry.boundingBox.max, geometryToBvh );
		cachedObb = obb$2;

	}

	const isLeaf = IS_LEAF( nodeIndex16, uint16Array );
	if ( isLeaf ) {

		const thisGeometry = bvh.geometry;
		const thisIndex = thisGeometry.index;
		const thisPos = thisGeometry.attributes.position;

		const index = otherGeometry.index;
		const pos = otherGeometry.attributes.position;

		const offset = OFFSET( nodeIndex32, uint32Array );
		const count = COUNT( nodeIndex16, uint16Array );

		// get the inverse of the geometry matrix so we can transform our triangles into the
		// geometry space we're trying to test. We assume there are fewer triangles being checked
		// here.
		invertedMat.copy( geometryToBvh ).invert();

		if ( otherGeometry.boundsTree ) {

			// if there's a bounds tree
			arrayToBox( BOUNDING_DATA_INDEX( nodeIndex32 ), float32Array, obb2$1 );
			obb2$1.matrix.copy( invertedMat );
			obb2$1.needsUpdate = true;

			// TODO: use a triangle iteration function here
			const res = otherGeometry.boundsTree.shapecast( {

				intersectsBounds: box => obb2$1.intersectsBox( box ),

				intersectsTriangle: tri => {

					tri.a.applyMatrix4( geometryToBvh );
					tri.b.applyMatrix4( geometryToBvh );
					tri.c.applyMatrix4( geometryToBvh );
					tri.needsUpdate = true;

					for ( let i = offset, l = count + offset; i < l; i ++ ) {

						// this triangle needs to be transformed into the current BVH coordinate frame
						setTriangle( triangle2, 3 * bvh.resolveTriangleIndex( i ), thisIndex, thisPos );
						triangle2.needsUpdate = true;
						if ( tri.intersectsTriangle( triangle2 ) ) {

							return true;

						}

					}


					return false;

				}

			} );

			return res;

		} else {

			// if we're just dealing with raw geometry
			for ( let i = offset, l = count + offset; i < l; i ++ ) {

				// this triangle needs to be transformed into the current BVH coordinate frame
				const ti = bvh.resolveTriangleIndex( i );
				setTriangle( triangle, 3 * ti, thisIndex, thisPos );


				triangle.a.applyMatrix4( invertedMat );
				triangle.b.applyMatrix4( invertedMat );
				triangle.c.applyMatrix4( invertedMat );
				triangle.needsUpdate = true;

				for ( let i2 = 0, l2 = index.count; i2 < l2; i2 += 3 ) {

					setTriangle( triangle2, i2, index, pos );
					triangle2.needsUpdate = true;

					if ( triangle.intersectsTriangle( triangle2 ) ) {

						return true;

					}

				}

			}


		}

	} else {

		const left = nodeIndex32 + 8;
		const right = uint32Array[ nodeIndex32 + 6 ];

		arrayToBox( BOUNDING_DATA_INDEX( left ), float32Array, boundingBox$1 );
		const leftIntersection =
			cachedObb.intersectsBox( boundingBox$1 ) &&
			_intersectsGeometry( left, bvh, otherGeometry, geometryToBvh, cachedObb );

		if ( leftIntersection ) return true;

		arrayToBox( BOUNDING_DATA_INDEX( right ), float32Array, boundingBox$1 );
		const rightIntersection =
			cachedObb.intersectsBox( boundingBox$1 ) &&
			_intersectsGeometry( right, bvh, otherGeometry, geometryToBvh, cachedObb );

		if ( rightIntersection ) return true;

		return false;

	}

}

/*********************************************************************/
/* This file is generated from "closestPointToGeometry.template.js". */
/*********************************************************************/

const tempMatrix = /* @__PURE__ */ new Matrix4();
const obb$1 = /* @__PURE__ */ new OrientedBox();
const obb2 = /* @__PURE__ */ new OrientedBox();
const temp1 = /* @__PURE__ */ new Vector3();
const temp2 = /* @__PURE__ */ new Vector3();
const temp3 = /* @__PURE__ */ new Vector3();
const temp4 = /* @__PURE__ */ new Vector3();

function closestPointToGeometry_indirect(
	bvh,
	otherGeometry,
	geometryToBvh,
	target1 = { },
	target2 = { },
	minThreshold = 0,
	maxThreshold = Infinity,
) {

	if ( ! otherGeometry.boundingBox ) {

		otherGeometry.computeBoundingBox();

	}

	obb$1.set( otherGeometry.boundingBox.min, otherGeometry.boundingBox.max, geometryToBvh );
	obb$1.needsUpdate = true;

	const geometry = bvh.geometry;
	const pos = geometry.attributes.position;
	const index = geometry.index;
	const otherPos = otherGeometry.attributes.position;
	const otherIndex = otherGeometry.index;
	const triangle = ExtendedTrianglePool.getPrimitive();
	const triangle2 = ExtendedTrianglePool.getPrimitive();

	let tempTarget1 = temp1;
	let tempTargetDest1 = temp2;
	let tempTarget2 = null;
	let tempTargetDest2 = null;

	if ( target2 ) {

		tempTarget2 = temp3;
		tempTargetDest2 = temp4;

	}

	let closestDistance = Infinity;
	let closestDistanceTriIndex = null;
	let closestDistanceOtherTriIndex = null;
	tempMatrix.copy( geometryToBvh ).invert();
	obb2.matrix.copy( tempMatrix );
	bvh.shapecast(
		{

			boundsTraverseOrder: box => {

				return obb$1.distanceToBox( box );

			},

			intersectsBounds: ( box, isLeaf, score ) => {

				if ( score < closestDistance && score < maxThreshold ) {

					// if we know the triangles of this bounds will be intersected next then
					// save the bounds to use during triangle checks.
					if ( isLeaf ) {

						obb2.min.copy( box.min );
						obb2.max.copy( box.max );
						obb2.needsUpdate = true;

					}

					return true;

				}

				return false;

			},

			intersectsRange: ( offset, count ) => {

				if ( otherGeometry.boundsTree ) {

					// if the other geometry has a bvh then use the accelerated path where we use shapecast to find
					// the closest bounds in the other geometry to check.
					const otherBvh = otherGeometry.boundsTree;
					return otherBvh.shapecast( {
						boundsTraverseOrder: box => {

							return obb2.distanceToBox( box );

						},

						intersectsBounds: ( box, isLeaf, score ) => {

							return score < closestDistance && score < maxThreshold;

						},

						intersectsRange: ( otherOffset, otherCount ) => {

							for ( let i2 = otherOffset, l2 = otherOffset + otherCount; i2 < l2; i2 ++ ) {

								const ti2 = otherBvh.resolveTriangleIndex( i2 );
								setTriangle( triangle2, 3 * ti2, otherIndex, otherPos );

								triangle2.a.applyMatrix4( geometryToBvh );
								triangle2.b.applyMatrix4( geometryToBvh );
								triangle2.c.applyMatrix4( geometryToBvh );
								triangle2.needsUpdate = true;

								for ( let i = offset, l = offset + count; i < l; i ++ ) {

									const ti = bvh.resolveTriangleIndex( i );
									setTriangle( triangle, 3 * ti, index, pos );

									triangle.needsUpdate = true;

									const dist = triangle.distanceToTriangle( triangle2, tempTarget1, tempTarget2 );
									if ( dist < closestDistance ) {

										tempTargetDest1.copy( tempTarget1 );

										if ( tempTargetDest2 ) {

											tempTargetDest2.copy( tempTarget2 );

										}

										closestDistance = dist;
										closestDistanceTriIndex = i;
										closestDistanceOtherTriIndex = i2;

									}

									// stop traversal if we find a point that's under the given threshold
									if ( dist < minThreshold ) {

										return true;

									}

								}

							}

						},
					} );

				} else {

					// If no bounds tree then we'll just check every triangle.
					const triCount = getTriCount( otherGeometry );
					for ( let i2 = 0, l2 = triCount; i2 < l2; i2 ++ ) {

						setTriangle( triangle2, 3 * i2, otherIndex, otherPos );
						triangle2.a.applyMatrix4( geometryToBvh );
						triangle2.b.applyMatrix4( geometryToBvh );
						triangle2.c.applyMatrix4( geometryToBvh );
						triangle2.needsUpdate = true;

						for ( let i = offset, l = offset + count; i < l; i ++ ) {

							const ti = bvh.resolveTriangleIndex( i );
							setTriangle( triangle, 3 * ti, index, pos );

							triangle.needsUpdate = true;

							const dist = triangle.distanceToTriangle( triangle2, tempTarget1, tempTarget2 );
							if ( dist < closestDistance ) {

								tempTargetDest1.copy( tempTarget1 );

								if ( tempTargetDest2 ) {

									tempTargetDest2.copy( tempTarget2 );

								}

								closestDistance = dist;
								closestDistanceTriIndex = i;
								closestDistanceOtherTriIndex = i2;

							}

							// stop traversal if we find a point that's under the given threshold
							if ( dist < minThreshold ) {

								return true;

							}

						}

					}

				}

			},

		}

	);

	ExtendedTrianglePool.releasePrimitive( triangle );
	ExtendedTrianglePool.releasePrimitive( triangle2 );

	if ( closestDistance === Infinity ) {

		return null;

	}

	if ( ! target1.point ) {

		target1.point = tempTargetDest1.clone();

	} else {

		target1.point.copy( tempTargetDest1 );

	}

	target1.distance = closestDistance,
	target1.faceIndex = closestDistanceTriIndex;

	if ( target2 ) {

		if ( ! target2.point ) target2.point = tempTargetDest2.clone();
		else target2.point.copy( tempTargetDest2 );
		target2.point.applyMatrix4( tempMatrix );
		tempTargetDest1.applyMatrix4( tempMatrix );
		target2.distance = tempTargetDest1.sub( target2.point ).length();
		target2.faceIndex = closestDistanceOtherTriIndex;

	}

	return target1;

}

function isSharedArrayBufferSupported() {

	return typeof SharedArrayBuffer !== 'undefined';

}

function convertToBufferType( array, BufferConstructor ) {

	if ( array === null ) {

		return array;

	} else if ( array.buffer ) {

		const buffer = array.buffer;
		if ( buffer.constructor === BufferConstructor ) {

			return array;

		}

		const ArrayConstructor = array.constructor;
		const result = new ArrayConstructor( new BufferConstructor( buffer.byteLength ) );
		result.set( array );
		return result;

	} else {

		if ( array.constructor === BufferConstructor ) {

			return array;

		}

		const result = new BufferConstructor( array.byteLength );
		new Uint8Array( result ).set( new Uint8Array( array ) );
		return result;

	}

}

const _bufferStack1 = new BufferStack.constructor();
const _bufferStack2 = new BufferStack.constructor();
const _boxPool = new PrimitivePool( () => new Box3() );
const _leftBox1 = new Box3();
const _rightBox1 = new Box3();

const _leftBox2 = new Box3();
const _rightBox2 = new Box3();

let _active = false;

function bvhcast( bvh, otherBvh, matrixToLocal, intersectsRanges ) {

	if ( _active ) {

		throw new Error( 'MeshBVH: Recursive calls to bvhcast not supported.' );

	}

	_active = true;

	const roots = bvh._roots;
	const otherRoots = otherBvh._roots;
	let result;
	let offset1 = 0;
	let offset2 = 0;
	const invMat = new Matrix4().copy( matrixToLocal ).invert();

	// iterate over the first set of roots
	for ( let i = 0, il = roots.length; i < il; i ++ ) {

		_bufferStack1.setBuffer( roots[ i ] );
		offset2 = 0;

		// prep the initial root box
		const localBox = _boxPool.getPrimitive();
		arrayToBox( BOUNDING_DATA_INDEX( 0 ), _bufferStack1.float32Array, localBox );
		localBox.applyMatrix4( invMat );

		// iterate over the second set of roots
		for ( let j = 0, jl = otherRoots.length; j < jl; j ++ ) {

			_bufferStack2.setBuffer( otherRoots[ i ] );

			result = _traverse(
				0, 0, matrixToLocal, invMat, intersectsRanges,
				offset1, offset2, 0, 0,
				localBox,
			);

			_bufferStack2.clearBuffer();
			offset2 += otherRoots[ j ].length;

			if ( result ) {

				break;

			}

		}

		// release stack info
		_boxPool.releasePrimitive( localBox );
		_bufferStack1.clearBuffer();
		offset1 += roots[ i ].length;

		if ( result ) {

			break;

		}

	}

	_active = false;
	return result;

}

function _traverse(
	node1Index32,
	node2Index32,
	matrix2to1,
	matrix1to2,
	intersectsRangesFunc,

	// offsets for ids
	node1IndexByteOffset = 0,
	node2IndexByteOffset = 0,

	// tree depth
	depth1 = 0,
	depth2 = 0,

	currBox = null,
	reversed = false,

) {

	// get the buffer stacks associated with the current indices
	let bufferStack1, bufferStack2;
	if ( reversed ) {

		bufferStack1 = _bufferStack2;
		bufferStack2 = _bufferStack1;

	} else {

		bufferStack1 = _bufferStack1;
		bufferStack2 = _bufferStack2;

	}

	// get the local instances of the typed buffers
	const
		float32Array1 = bufferStack1.float32Array,
		uint32Array1 = bufferStack1.uint32Array,
		uint16Array1 = bufferStack1.uint16Array,
		float32Array2 = bufferStack2.float32Array,
		uint32Array2 = bufferStack2.uint32Array,
		uint16Array2 = bufferStack2.uint16Array;

	const node1Index16 = node1Index32 * 2;
	const node2Index16 = node2Index32 * 2;
	const isLeaf1 = IS_LEAF( node1Index16, uint16Array1 );
	const isLeaf2 = IS_LEAF( node2Index16, uint16Array2 );
	let result = false;
	if ( isLeaf2 && isLeaf1 ) {

		// if both bounds are leaf nodes then fire the callback if the boxes intersect
		if ( reversed ) {

			result = intersectsRangesFunc(
				OFFSET( node2Index32, uint32Array2 ), COUNT( node2Index32 * 2, uint16Array2 ),
				OFFSET( node1Index32, uint32Array1 ), COUNT( node1Index32 * 2, uint16Array1 ),
				depth2, node2IndexByteOffset + node2Index32,
				depth1, node1IndexByteOffset + node1Index32,
			);

		} else {

			result = intersectsRangesFunc(
				OFFSET( node1Index32, uint32Array1 ), COUNT( node1Index32 * 2, uint16Array1 ),
				OFFSET( node2Index32, uint32Array2 ), COUNT( node2Index32 * 2, uint16Array2 ),
				depth1, node1IndexByteOffset + node1Index32,
				depth2, node2IndexByteOffset + node2Index32,
			);

		}

	} else if ( isLeaf2 ) {

		// SWAP
		// If we've traversed to the leaf node on the other bvh then we need to swap over
		// to traverse down the first one

		// get the new box to use
		const newBox = _boxPool.getPrimitive();
		arrayToBox( BOUNDING_DATA_INDEX( node2Index32 ), float32Array2, newBox );
		newBox.applyMatrix4( matrix2to1 );

		// get the child bounds to check before traversal
		const cl1 = LEFT_NODE( node1Index32 );
		const cr1 = RIGHT_NODE( node1Index32, uint32Array1 );
		arrayToBox( BOUNDING_DATA_INDEX( cl1 ), float32Array1, _leftBox1 );
		arrayToBox( BOUNDING_DATA_INDEX( cr1 ), float32Array1, _rightBox1 );

		// precompute the intersections otherwise the global boxes will be modified during traversal
		const intersectCl1 = newBox.intersectsBox( _leftBox1 );
		const intersectCr1 = newBox.intersectsBox( _rightBox1 );
		result = (
			intersectCl1 && _traverse(
				node2Index32, cl1, matrix1to2, matrix2to1, intersectsRangesFunc,
				node2IndexByteOffset, node1IndexByteOffset, depth2, depth1 + 1,
				newBox, ! reversed,
			)
		) || (
			intersectCr1 && _traverse(
				node2Index32, cr1, matrix1to2, matrix2to1, intersectsRangesFunc,
				node2IndexByteOffset, node1IndexByteOffset, depth2, depth1 + 1,
				newBox, ! reversed,
			)
		);

		_boxPool.releasePrimitive( newBox );

	} else {

		// if neither are leaves then we should swap if one of the children does not
		// intersect with the current bounds

		// get the child bounds to check
		const cl2 = LEFT_NODE( node2Index32 );
		const cr2 = RIGHT_NODE( node2Index32, uint32Array2 );
		arrayToBox( BOUNDING_DATA_INDEX( cl2 ), float32Array2, _leftBox2 );
		arrayToBox( BOUNDING_DATA_INDEX( cr2 ), float32Array2, _rightBox2 );

		const leftIntersects = currBox.intersectsBox( _leftBox2 );
		const rightIntersects = currBox.intersectsBox( _rightBox2 );
		if ( leftIntersects && rightIntersects ) {

			// continue to traverse both children if they both intersect
			result = _traverse(
				node1Index32, cl2, matrix2to1, matrix1to2, intersectsRangesFunc,
				node1IndexByteOffset, node2IndexByteOffset, depth1, depth2 + 1,
				currBox, reversed,
			) || _traverse(
				node1Index32, cr2, matrix2to1, matrix1to2, intersectsRangesFunc,
				node1IndexByteOffset, node2IndexByteOffset, depth1, depth2 + 1,
				currBox, reversed,
			);

		} else if ( leftIntersects ) {

			if ( isLeaf1 ) {

				// if the current box is a leaf then just continue
				result = _traverse(
					node1Index32, cl2, matrix2to1, matrix1to2, intersectsRangesFunc,
					node1IndexByteOffset, node2IndexByteOffset, depth1, depth2 + 1,
					currBox, reversed,
				);

			} else {

				// SWAP
				// if only one box intersects then we have to swap to the other bvh to continue
				const newBox = _boxPool.getPrimitive();
				newBox.copy( _leftBox2 ).applyMatrix4( matrix2to1 );

				const cl1 = LEFT_NODE( node1Index32 );
				const cr1 = RIGHT_NODE( node1Index32, uint32Array1 );
				arrayToBox( BOUNDING_DATA_INDEX( cl1 ), float32Array1, _leftBox1 );
				arrayToBox( BOUNDING_DATA_INDEX( cr1 ), float32Array1, _rightBox1 );

				// precompute the intersections otherwise the global boxes will be modified during traversal
				const intersectCl1 = newBox.intersectsBox( _leftBox1 );
				const intersectCr1 = newBox.intersectsBox( _rightBox1 );
				result = (
					intersectCl1 && _traverse(
						cl2, cl1, matrix1to2, matrix2to1, intersectsRangesFunc,
						node2IndexByteOffset, node1IndexByteOffset, depth2, depth1 + 1,
						newBox, ! reversed,
					)
				) || (
					intersectCr1 && _traverse(
						cl2, cr1, matrix1to2, matrix2to1, intersectsRangesFunc,
						node2IndexByteOffset, node1IndexByteOffset, depth2, depth1 + 1,
						newBox, ! reversed,
					)
				);

				_boxPool.releasePrimitive( newBox );

			}

		} else if ( rightIntersects ) {

			if ( isLeaf1 ) {

				// if the current box is a leaf then just continue
				result = _traverse(
					node1Index32, cr2, matrix2to1, matrix1to2, intersectsRangesFunc,
					node1IndexByteOffset, node2IndexByteOffset, depth1, depth2 + 1,
					currBox, reversed,
				);

			} else {

				// SWAP
				// if only one box intersects then we have to swap to the other bvh to continue
				const newBox = _boxPool.getPrimitive();
				newBox.copy( _rightBox2 ).applyMatrix4( matrix2to1 );

				const cl1 = LEFT_NODE( node1Index32 );
				const cr1 = RIGHT_NODE( node1Index32, uint32Array1 );
				arrayToBox( BOUNDING_DATA_INDEX( cl1 ), float32Array1, _leftBox1 );
				arrayToBox( BOUNDING_DATA_INDEX( cr1 ), float32Array1, _rightBox1 );

				// precompute the intersections otherwise the global boxes will be modified during traversal
				const intersectCl1 = newBox.intersectsBox( _leftBox1 );
				const intersectCr1 = newBox.intersectsBox( _rightBox1 );
				result = (
					intersectCl1 && _traverse(
						cr2, cl1, matrix1to2, matrix2to1, intersectsRangesFunc,
						node2IndexByteOffset, node1IndexByteOffset, depth2, depth1 + 1,
						newBox, ! reversed,
					)
				) || (
					intersectCr1 && _traverse(
						cr2, cr1, matrix1to2, matrix2to1, intersectsRangesFunc,
						node2IndexByteOffset, node1IndexByteOffset, depth2, depth1 + 1,
						newBox, ! reversed,
					)
				);

				_boxPool.releasePrimitive( newBox );

			}

		}

	}

	return result;

}

const obb = /* @__PURE__ */ new OrientedBox();
const tempBox = /* @__PURE__ */ new Box3();
const DEFAULT_OPTIONS = {
	strategy: CENTER,
	maxDepth: 40,
	maxLeafTris: 10,
	useSharedArrayBuffer: false,
	setBoundingBox: true,
	onProgress: null,
	indirect: false,
	verbose: true,
};

class MeshBVH {

	static serialize( bvh, options = {} ) {

		options = {
			cloneBuffers: true,
			...options,
		};

		const geometry = bvh.geometry;
		const rootData = bvh._roots;
		const indirectBuffer = bvh._indirectBuffer;
		const indexAttribute = geometry.getIndex();
		let result;
		if ( options.cloneBuffers ) {

			result = {
				roots: rootData.map( root => root.slice() ),
				index: indexAttribute ? indexAttribute.array.slice() : null,
				indirectBuffer: indirectBuffer ? indirectBuffer.slice() : null,
			};

		} else {

			result = {
				roots: rootData,
				index: indexAttribute ? indexAttribute.array : null,
				indirectBuffer: indirectBuffer,
			};

		}

		return result;

	}

	static deserialize( data, geometry, options = {} ) {

		options = {
			setIndex: true,
			indirect: Boolean( data.indirectBuffer ),
			...options,
		};

		const { index, roots, indirectBuffer } = data;
		const bvh = new MeshBVH( geometry, { ...options, [ SKIP_GENERATION ]: true } );
		bvh._roots = roots;
		bvh._indirectBuffer = indirectBuffer || null;

		if ( options.setIndex ) {

			const indexAttribute = geometry.getIndex();
			if ( indexAttribute === null ) {

				const newIndex = new BufferAttribute( data.index, 1, false );
				geometry.setIndex( newIndex );

			} else if ( indexAttribute.array !== index ) {

				indexAttribute.array.set( index );
				indexAttribute.needsUpdate = true;

			}

		}

		return bvh;

	}

	get indirect() {

		return ! ! this._indirectBuffer;

	}

	constructor( geometry, options = {} ) {

		if ( ! geometry.isBufferGeometry ) {

			throw new Error( 'MeshBVH: Only BufferGeometries are supported.' );

		} else if ( geometry.index && geometry.index.isInterleavedBufferAttribute ) {

			throw new Error( 'MeshBVH: InterleavedBufferAttribute is not supported for the index attribute.' );

		}

		// default options
		options = Object.assign( {

			...DEFAULT_OPTIONS,

			// undocumented options

			// Whether to skip generating the tree. Used for deserialization.
			[ SKIP_GENERATION ]: false,

		}, options );

		if ( options.useSharedArrayBuffer && ! isSharedArrayBufferSupported() ) {

			throw new Error( 'MeshBVH: SharedArrayBuffer is not available.' );

		}

		// retain references to the geometry so we can use them it without having to
		// take a geometry reference in every function.
		this.geometry = geometry;
		this._roots = null;
		this._indirectBuffer = null;
		if ( ! options[ SKIP_GENERATION ] ) {

			buildPackedTree( this, options );

			if ( ! geometry.boundingBox && options.setBoundingBox ) {

				geometry.boundingBox = this.getBoundingBox( new Box3() );

			}

		}

		this.resolveTriangleIndex = options.indirect ? i => this._indirectBuffer[ i ] : i => i;

	}

	refit( nodeIndices = null ) {

		const refitFunc = this.indirect ? refit_indirect : refit;
		return refitFunc( this, nodeIndices );

	}

	traverse( callback, rootIndex = 0 ) {

		const buffer = this._roots[ rootIndex ];
		const uint32Array = new Uint32Array( buffer );
		const uint16Array = new Uint16Array( buffer );
		_traverse( 0 );

		function _traverse( node32Index, depth = 0 ) {

			const node16Index = node32Index * 2;
			const isLeaf = uint16Array[ node16Index + 15 ] === IS_LEAFNODE_FLAG;
			if ( isLeaf ) {

				const offset = uint32Array[ node32Index + 6 ];
				const count = uint16Array[ node16Index + 14 ];
				callback( depth, isLeaf, new Float32Array( buffer, node32Index * 4, 6 ), offset, count );

			} else {

				// TODO: use node functions here
				const left = node32Index + BYTES_PER_NODE / 4;
				const right = uint32Array[ node32Index + 6 ];
				const splitAxis = uint32Array[ node32Index + 7 ];
				const stopTraversal = callback( depth, isLeaf, new Float32Array( buffer, node32Index * 4, 6 ), splitAxis );

				if ( ! stopTraversal ) {

					_traverse( left, depth + 1 );
					_traverse( right, depth + 1 );

				}

			}

		}

	}

	/* Core Cast Functions */
	raycast( ray, materialOrSide = FrontSide, near = 0, far = Infinity ) {

		const roots = this._roots;
		const geometry = this.geometry;
		const intersects = [];
		const isMaterial = materialOrSide.isMaterial;
		const isArrayMaterial = Array.isArray( materialOrSide );

		const groups = geometry.groups;
		const side = isMaterial ? materialOrSide.side : materialOrSide;
		const raycastFunc = this.indirect ? raycast_indirect : raycast;
		for ( let i = 0, l = roots.length; i < l; i ++ ) {

			const materialSide = isArrayMaterial ? materialOrSide[ groups[ i ].materialIndex ].side : side;
			const startCount = intersects.length;

			raycastFunc( this, i, materialSide, ray, intersects, near, far );

			if ( isArrayMaterial ) {

				const materialIndex = groups[ i ].materialIndex;
				for ( let j = startCount, jl = intersects.length; j < jl; j ++ ) {

					intersects[ j ].face.materialIndex = materialIndex;

				}

			}

		}

		return intersects;

	}

	raycastFirst( ray, materialOrSide = FrontSide, near = 0, far = Infinity ) {

		const roots = this._roots;
		const geometry = this.geometry;
		const isMaterial = materialOrSide.isMaterial;
		const isArrayMaterial = Array.isArray( materialOrSide );

		let closestResult = null;

		const groups = geometry.groups;
		const side = isMaterial ? materialOrSide.side : materialOrSide;
		const raycastFirstFunc = this.indirect ? raycastFirst_indirect : raycastFirst;
		for ( let i = 0, l = roots.length; i < l; i ++ ) {

			const materialSide = isArrayMaterial ? materialOrSide[ groups[ i ].materialIndex ].side : side;
			const result = raycastFirstFunc( this, i, materialSide, ray, near, far );
			if ( result != null && ( closestResult == null || result.distance < closestResult.distance ) ) {

				closestResult = result;
				if ( isArrayMaterial ) {

					result.face.materialIndex = groups[ i ].materialIndex;

				}

			}

		}

		return closestResult;

	}

	intersectsGeometry( otherGeometry, geomToMesh ) {

		let result = false;
		const roots = this._roots;
		const intersectsGeometryFunc = this.indirect ? intersectsGeometry_indirect : intersectsGeometry;
		for ( let i = 0, l = roots.length; i < l; i ++ ) {

			result = intersectsGeometryFunc( this, i, otherGeometry, geomToMesh );

			if ( result ) {

				break;

			}

		}

		return result;

	}

	shapecast( callbacks ) {

		const triangle = ExtendedTrianglePool.getPrimitive();
		const iterateFunc = this.indirect ? iterateOverTriangles_indirect : iterateOverTriangles;
		let {
			boundsTraverseOrder,
			intersectsBounds,
			intersectsRange,
			intersectsTriangle,
		} = callbacks;

		// wrap the intersectsRange function
		if ( intersectsRange && intersectsTriangle ) {

			const originalIntersectsRange = intersectsRange;
			intersectsRange = ( offset, count, contained, depth, nodeIndex ) => {

				if ( ! originalIntersectsRange( offset, count, contained, depth, nodeIndex ) ) {

					return iterateFunc( offset, count, this, intersectsTriangle, contained, depth, triangle );

				}

				return true;

			};

		} else if ( ! intersectsRange ) {

			if ( intersectsTriangle ) {

				intersectsRange = ( offset, count, contained, depth ) => {

					return iterateFunc( offset, count, this, intersectsTriangle, contained, depth, triangle );

				};

			} else {

				intersectsRange = ( offset, count, contained ) => {

					return contained;

				};

			}

		}

		// run shapecast
		let result = false;
		let byteOffset = 0;
		const roots = this._roots;
		for ( let i = 0, l = roots.length; i < l; i ++ ) {

			const root = roots[ i ];
			result = shapecast( this, i, intersectsBounds, intersectsRange, boundsTraverseOrder, byteOffset );

			if ( result ) {

				break;

			}

			byteOffset += root.byteLength;

		}

		ExtendedTrianglePool.releasePrimitive( triangle );

		return result;

	}

	bvhcast( otherBvh, matrixToLocal, callbacks ) {

		let {
			intersectsRanges,
			intersectsTriangles,
		} = callbacks;

		const triangle1 = ExtendedTrianglePool.getPrimitive();
		const indexAttr1 = this.geometry.index;
		const positionAttr1 = this.geometry.attributes.position;
		const assignTriangle1 = this.indirect ?
			i1 => {


				const ti = this.resolveTriangleIndex( i1 );
				setTriangle( triangle1, ti * 3, indexAttr1, positionAttr1 );

			} :
			i1 => {

				setTriangle( triangle1, i1 * 3, indexAttr1, positionAttr1 );

			};

		const triangle2 = ExtendedTrianglePool.getPrimitive();
		const indexAttr2 = otherBvh.geometry.index;
		const positionAttr2 = otherBvh.geometry.attributes.position;
		const assignTriangle2 = otherBvh.indirect ?
			i2 => {

				const ti2 = otherBvh.resolveTriangleIndex( i2 );
				setTriangle( triangle2, ti2 * 3, indexAttr2, positionAttr2 );

			} :
			i2 => {

				setTriangle( triangle2, i2 * 3, indexAttr2, positionAttr2 );

			};

		// generate triangle callback if needed
		if ( intersectsTriangles ) {

			const iterateOverDoubleTriangles = ( offset1, count1, offset2, count2, depth1, index1, depth2, index2 ) => {

				for ( let i2 = offset2, l2 = offset2 + count2; i2 < l2; i2 ++ ) {

					assignTriangle2( i2 );

					triangle2.a.applyMatrix4( matrixToLocal );
					triangle2.b.applyMatrix4( matrixToLocal );
					triangle2.c.applyMatrix4( matrixToLocal );
					triangle2.needsUpdate = true;

					for ( let i1 = offset1, l1 = offset1 + count1; i1 < l1; i1 ++ ) {

						assignTriangle1( i1 );

						triangle1.needsUpdate = true;

						if ( intersectsTriangles( triangle1, triangle2, i1, i2, depth1, index1, depth2, index2 ) ) {

							return true;

						}

					}

				}

				return false;

			};

			if ( intersectsRanges ) {

				const originalIntersectsRanges = intersectsRanges;
				intersectsRanges = function ( offset1, count1, offset2, count2, depth1, index1, depth2, index2 ) {

					if ( ! originalIntersectsRanges( offset1, count1, offset2, count2, depth1, index1, depth2, index2 ) ) {

						return iterateOverDoubleTriangles( offset1, count1, offset2, count2, depth1, index1, depth2, index2 );

					}

					return true;

				};

			} else {

				intersectsRanges = iterateOverDoubleTriangles;

			}

		}

		return bvhcast( this, otherBvh, matrixToLocal, intersectsRanges );

	}


	/* Derived Cast Functions */
	intersectsBox( box, boxToMesh ) {

		obb.set( box.min, box.max, boxToMesh );
		obb.needsUpdate = true;

		return this.shapecast(
			{
				intersectsBounds: box => obb.intersectsBox( box ),
				intersectsTriangle: tri => obb.intersectsTriangle( tri )
			}
		);

	}

	intersectsSphere( sphere ) {

		return this.shapecast(
			{
				intersectsBounds: box => sphere.intersectsBox( box ),
				intersectsTriangle: tri => tri.intersectsSphere( sphere )
			}
		);

	}

	closestPointToGeometry( otherGeometry, geometryToBvh, target1 = { }, target2 = { }, minThreshold = 0, maxThreshold = Infinity ) {

		const closestPointToGeometryFunc = this.indirect ? closestPointToGeometry_indirect : closestPointToGeometry;
		return closestPointToGeometryFunc(
			this,
			otherGeometry,
			geometryToBvh,
			target1,
			target2,
			minThreshold,
			maxThreshold,
		);

	}

	closestPointToPoint( point, target = { }, minThreshold = 0, maxThreshold = Infinity ) {

		return closestPointToPoint(
			this,
			point,
			target,
			minThreshold,
			maxThreshold,
		);

	}

	getBoundingBox( target ) {

		target.makeEmpty();

		const roots = this._roots;
		roots.forEach( buffer => {

			arrayToBox( 0, new Float32Array( buffer ), tempBox );
			target.union( tempBox );

		} );

		return target;

	}

}

const boundingBox = /* @__PURE__ */ new Box3();
class MeshBVHRootHelper extends Object3D {

	get isMesh() {

		return ! this.displayEdges;

	}

	get isLineSegments() {

		return this.displayEdges;

	}

	get isLine() {

		return this.displayEdges;

	}

	constructor( bvh, material, depth = 10, group = 0 ) {

		super();

		this.material = material;
		this.geometry = new BufferGeometry();
		this.name = 'MeshBVHRootHelper';
		this.depth = depth;
		this.displayParents = false;
		this.bvh = bvh;
		this.displayEdges = true;
		this._group = group;

	}

	raycast() {}

	update() {

		const geometry = this.geometry;
		const boundsTree = this.bvh;
		const group = this._group;
		geometry.dispose();
		this.visible = false;
		if ( boundsTree ) {

			// count the number of bounds required
			const targetDepth = this.depth - 1;
			const displayParents = this.displayParents;
			let boundsCount = 0;
			boundsTree.traverse( ( depth, isLeaf ) => {

				if ( depth >= targetDepth || isLeaf ) {

					boundsCount ++;
					return true;

				} else if ( displayParents ) {

					boundsCount ++;

				}

			}, group );

			// fill in the position buffer with the bounds corners
			let posIndex = 0;
			const positionArray = new Float32Array( 8 * 3 * boundsCount );
			boundsTree.traverse( ( depth, isLeaf, boundingData ) => {

				const terminate = depth >= targetDepth || isLeaf;
				if ( terminate || displayParents ) {

					arrayToBox( 0, boundingData, boundingBox );

					const { min, max } = boundingBox;
					for ( let x = - 1; x <= 1; x += 2 ) {

						const xVal = x < 0 ? min.x : max.x;
						for ( let y = - 1; y <= 1; y += 2 ) {

							const yVal = y < 0 ? min.y : max.y;
							for ( let z = - 1; z <= 1; z += 2 ) {

								const zVal = z < 0 ? min.z : max.z;
								positionArray[ posIndex + 0 ] = xVal;
								positionArray[ posIndex + 1 ] = yVal;
								positionArray[ posIndex + 2 ] = zVal;

								posIndex += 3;

							}

						}

					}

					return terminate;

				}

			}, group );

			let indexArray;
			let indices;
			if ( this.displayEdges ) {

				// fill in the index buffer to point to the corner points
				indices = new Uint8Array( [
					// x axis
					0, 4,
					1, 5,
					2, 6,
					3, 7,

					// y axis
					0, 2,
					1, 3,
					4, 6,
					5, 7,

					// z axis
					0, 1,
					2, 3,
					4, 5,
					6, 7,
				] );

			} else {

				indices = new Uint8Array( [

					// X-, X+
					0, 1, 2,
					2, 1, 3,

					4, 6, 5,
					6, 7, 5,

					// Y-, Y+
					1, 4, 5,
					0, 4, 1,

					2, 3, 6,
					3, 7, 6,

					// Z-, Z+
					0, 2, 4,
					2, 6, 4,

					1, 5, 3,
					3, 5, 7,

				] );

			}

			if ( positionArray.length > 65535 ) {

				indexArray = new Uint32Array( indices.length * boundsCount );

			} else {

				indexArray = new Uint16Array( indices.length * boundsCount );

			}

			const indexLength = indices.length;
			for ( let i = 0; i < boundsCount; i ++ ) {

				const posOffset = i * 8;
				const indexOffset = i * indexLength;
				for ( let j = 0; j < indexLength; j ++ ) {

					indexArray[ indexOffset + j ] = posOffset + indices[ j ];

				}

			}

			// update the geometry
			geometry.setIndex(
				new BufferAttribute( indexArray, 1, false ),
			);
			geometry.setAttribute(
				'position',
				new BufferAttribute( positionArray, 3, false ),
			);
			this.visible = true;

		}

	}

}

class MeshBVHHelper extends Group {

	get color() {

		return this.edgeMaterial.color;

	}

	get opacity() {

		return this.edgeMaterial.opacity;

	}

	set opacity( v ) {

		this.edgeMaterial.opacity = v;
		this.meshMaterial.opacity = v;

	}

	constructor( mesh = null, bvh = null, depth = 10 ) {

		// handle bvh, depth signature
		if ( mesh instanceof MeshBVH ) {

			depth = bvh || 10;
			bvh = mesh;
			mesh = null;

		}

		// handle mesh, depth signature
		if ( typeof bvh === 'number' ) {

			depth = bvh;
			bvh = null;

		}

		super();

		this.name = 'MeshBVHHelper';
		this.depth = depth;
		this.mesh = mesh;
		this.bvh = bvh;
		this.displayParents = false;
		this.displayEdges = true;
		this._roots = [];

		const edgeMaterial = new LineBasicMaterial( {
			color: 0x00FF88,
			transparent: true,
			opacity: 0.3,
			depthWrite: false,
		} );

		const meshMaterial = new MeshBasicMaterial( {
			color: 0x00FF88,
			transparent: true,
			opacity: 0.3,
			depthWrite: false,
		} );

		meshMaterial.color = edgeMaterial.color;

		this.edgeMaterial = edgeMaterial;
		this.meshMaterial = meshMaterial;

		this.update();

	}

	update() {

		const bvh = this.bvh || this.mesh.geometry.boundsTree;
		const totalRoots = bvh ? bvh._roots.length : 0;
		while ( this._roots.length > totalRoots ) {

			const root = this._roots.pop();
			root.geometry.dispose();
			this.remove( root );

		}

		for ( let i = 0; i < totalRoots; i ++ ) {

			const { depth, edgeMaterial, meshMaterial, displayParents, displayEdges } = this;

			if ( i >= this._roots.length ) {

				const root = new MeshBVHRootHelper( bvh, edgeMaterial, depth, i );
				this.add( root );
				this._roots.push( root );

			}

			const root = this._roots[ i ];
			root.bvh = bvh;
			root.depth = depth;
			root.displayParents = displayParents;
			root.displayEdges = displayEdges;
			root.material = displayEdges ? edgeMaterial : meshMaterial;
			root.update();

		}

	}

	updateMatrixWorld( ...args ) {

		const mesh = this.mesh;
		const parent = this.parent;

		if ( mesh !== null ) {

			mesh.updateWorldMatrix( true, false );

			if ( parent ) {

				this.matrix
					.copy( parent.matrixWorld )
					.invert()
					.multiply( mesh.matrixWorld );

			} else {

				this.matrix
					.copy( mesh.matrixWorld );

			}

			this.matrix.decompose(
				this.position,
				this.quaternion,
				this.scale,
			);

		}

		super.updateMatrixWorld( ...args );

	}

	copy( source ) {

		this.depth = source.depth;
		this.mesh = source.mesh;
		this.bvh = source.bvh;
		this.opacity = source.opacity;
		this.color.copy( source.color );

	}

	clone() {

		return new MeshBVHHelper( this.mesh, this.bvh, this.depth );

	}

	dispose() {

		this.edgeMaterial.dispose();
		this.meshMaterial.dispose();

		const children = this.children;
		for ( let i = 0, l = children.length; i < l; i ++ ) {

			children[ i ].geometry.dispose();

		}

	}

}

class MeshBVHVisualizer extends MeshBVHHelper {

	constructor( ...args ) {

		super( ...args );

		console.warn( 'MeshBVHVisualizer: MeshBVHVisualizer has been deprecated. Use MeshBVHHelper, instead.' );

	}

}

const _box1 = /* @__PURE__ */ new Box3();
const _box2 = /* @__PURE__ */ new Box3();
const _vec = /* @__PURE__ */ new Vector3();

// https://stackoverflow.com/questions/1248302/how-to-get-the-size-of-a-javascript-object
function getPrimitiveSize( el ) {

	switch ( typeof el ) {

		case 'number':
			return 8;
		case 'string':
			return el.length * 2;
		case 'boolean':
			return 4;
		default:
			return 0;

	}

}

function isTypedArray( arr ) {

	const regex = /(Uint|Int|Float)(8|16|32)Array/;
	return regex.test( arr.constructor.name );

}

function getRootExtremes( bvh, group ) {

	const result = {
		nodeCount: 0,
		leafNodeCount: 0,

		depth: {
			min: Infinity, max: - Infinity
		},
		tris: {
			min: Infinity, max: - Infinity
		},
		splits: [ 0, 0, 0 ],
		surfaceAreaScore: 0,
	};

	bvh.traverse( ( depth, isLeaf, boundingData, offsetOrSplit, count ) => {

		const l0 = boundingData[ 0 + 3 ] - boundingData[ 0 ];
		const l1 = boundingData[ 1 + 3 ] - boundingData[ 1 ];
		const l2 = boundingData[ 2 + 3 ] - boundingData[ 2 ];

		const surfaceArea = 2 * ( l0 * l1 + l1 * l2 + l2 * l0 );

		result.nodeCount ++;
		if ( isLeaf ) {

			result.leafNodeCount ++;

			result.depth.min = Math.min( depth, result.depth.min );
			result.depth.max = Math.max( depth, result.depth.max );

			result.tris.min = Math.min( count, result.tris.min );
			result.tris.max = Math.max( count, result.tris.max );

			result.surfaceAreaScore += surfaceArea * TRIANGLE_INTERSECT_COST * count;

		} else {

			result.splits[ offsetOrSplit ] ++;

			result.surfaceAreaScore += surfaceArea * TRAVERSAL_COST;

		}

	}, group );

	// If there are no leaf nodes because the tree hasn't finished generating yet.
	if ( result.tris.min === Infinity ) {

		result.tris.min = 0;
		result.tris.max = 0;

	}

	if ( result.depth.min === Infinity ) {

		result.depth.min = 0;
		result.depth.max = 0;

	}

	return result;

}

function getBVHExtremes( bvh ) {

	return bvh._roots.map( ( root, i ) => getRootExtremes( bvh, i ) );

}

function estimateMemoryInBytes( obj ) {

	const traversed = new Set();
	const stack = [ obj ];
	let bytes = 0;

	while ( stack.length ) {

		const curr = stack.pop();
		if ( traversed.has( curr ) ) {

			continue;

		}

		traversed.add( curr );

		for ( let key in curr ) {

			if ( ! Object.hasOwn( curr, key ) ) {

				continue;

			}

			bytes += getPrimitiveSize( key );

			const value = curr[ key ];
			if ( value && ( typeof value === 'object' || typeof value === 'function' ) ) {

				if ( isTypedArray( value ) ) {

					bytes += value.byteLength;

				} else if ( isSharedArrayBufferSupported() && value instanceof SharedArrayBuffer ) {

					bytes += value.byteLength;

				} else if ( value instanceof ArrayBuffer ) {

					bytes += value.byteLength;

				} else {

					stack.push( value );

				}

			} else {

				bytes += getPrimitiveSize( value );

			}


		}

	}

	return bytes;

}

function validateBounds( bvh ) {

	const geometry = bvh.geometry;
	const depthStack = [];
	const index = geometry.index;
	const position = geometry.getAttribute( 'position' );
	let passes = true;

	bvh.traverse( ( depth, isLeaf, boundingData, offset, count ) => {

		const info = {
			depth,
			isLeaf,
			boundingData,
			offset,
			count,
		};
		depthStack[ depth ] = info;

		arrayToBox( 0, boundingData, _box1 );
		const parent = depthStack[ depth - 1 ];

		if ( isLeaf ) {

			// check triangles
			for ( let i = offset, l = offset + count; i < l; i ++ ) {

				const triIndex = bvh.resolveTriangleIndex( i );
				let i0 = 3 * triIndex;
				let i1 = 3 * triIndex + 1;
				let i2 = 3 * triIndex + 2;

				if ( index ) {

					i0 = index.getX( i0 );
					i1 = index.getX( i1 );
					i2 = index.getX( i2 );

				}

				let isContained;

				_vec.fromBufferAttribute( position, i0 );
				isContained = _box1.containsPoint( _vec );

				_vec.fromBufferAttribute( position, i1 );
				isContained = isContained && _box1.containsPoint( _vec );

				_vec.fromBufferAttribute( position, i2 );
				isContained = isContained && _box1.containsPoint( _vec );

				console.assert( isContained, 'Leaf bounds does not fully contain triangle.' );
				passes = passes && isContained;

			}

		}

		if ( parent ) {

			// check if my bounds fit in my parents
			arrayToBox( 0, boundingData, _box2 );

			const isContained = _box2.containsBox( _box1 );
			console.assert( isContained, 'Parent bounds does not fully contain child.' );
			passes = passes && isContained;

		}

	} );

	return passes;

}

// Returns a simple, human readable object that represents the BVH.
function getJSONStructure( bvh ) {

	const depthStack = [];

	bvh.traverse( ( depth, isLeaf, boundingData, offset, count ) => {

		const info = {
			bounds: arrayToBox( 0, boundingData, new Box3() ),
		};

		if ( isLeaf ) {

			info.count = count;
			info.offset = offset;

		} else {

			info.left = null;
			info.right = null;

		}

		depthStack[ depth ] = info;

		// traversal hits the left then right node
		const parent = depthStack[ depth - 1 ];
		if ( parent ) {

			if ( parent.left === null ) {

				parent.left = info;

			} else {

				parent.right = info;

			}

		}

	} );

	return depthStack[ 0 ];

}

// converts the given BVH raycast intersection to align with the three.js raycast
// structure (include object, world space distance and point).
function convertRaycastIntersect( hit, object, raycaster ) {

	if ( hit === null ) {

		return null;

	}

	hit.point.applyMatrix4( object.matrixWorld );
	hit.distance = hit.point.distanceTo( raycaster.ray.origin );
	hit.object = object;

	return hit;

}

const ray = /* @__PURE__ */ new Ray();
const direction = /* @__PURE__ */ new Vector3();
const tmpInverseMatrix = /* @__PURE__ */ new Matrix4();
const origMeshRaycastFunc = Mesh.prototype.raycast;
const _worldScale = /* @__PURE__ */ new Vector3();

function acceleratedRaycast( raycaster, intersects ) {

	if ( this.geometry.boundsTree ) {

		if ( this.material === undefined ) return;

		tmpInverseMatrix.copy( this.matrixWorld ).invert();
		ray.copy( raycaster.ray ).applyMatrix4( tmpInverseMatrix );

		extractMatrixScale( this.matrixWorld, _worldScale );
		direction.copy( ray.direction ).multiply( _worldScale );

		const scaleFactor = direction.length();
		const near = raycaster.near / scaleFactor;
		const far = raycaster.far / scaleFactor;

		const bvh = this.geometry.boundsTree;
		if ( raycaster.firstHitOnly === true ) {

			const hit = convertRaycastIntersect( bvh.raycastFirst( ray, this.material, near, far ), this, raycaster );
			if ( hit ) {

				intersects.push( hit );

			}

		} else {

			const hits = bvh.raycast( ray, this.material, near, far );
			for ( let i = 0, l = hits.length; i < l; i ++ ) {

				const hit = convertRaycastIntersect( hits[ i ], this, raycaster );
				if ( hit ) {

					intersects.push( hit );

				}

			}

		}

	} else {

		origMeshRaycastFunc.call( this, raycaster, intersects );

	}

}

function computeBoundsTree( options ) {

	this.boundsTree = new MeshBVH( this, options );
	return this.boundsTree;

}

function disposeBoundsTree() {

	this.boundsTree = null;

}

// https://github.com/mrdoob/three.js/blob/dev/src/math/Matrix4.js#L732
// extracting the scale directly is ~3x faster than using "decompose"
function extractMatrixScale( matrix, target ) {

	const te = matrix.elements;
	const sx = target.set( te[ 0 ], te[ 1 ], te[ 2 ] ).length();
	const sy = target.set( te[ 4 ], te[ 5 ], te[ 6 ] ).length();
	const sz = target.set( te[ 8 ], te[ 9 ], te[ 10 ] ).length();
	return target.set( sx, sy, sz );

}

function countToStringFormat( count ) {

	switch ( count ) {

		case 1: return 'R';
		case 2: return 'RG';
		case 3: return 'RGBA';
		case 4: return 'RGBA';

	}

	throw new Error();

}

function countToFormat( count ) {

	switch ( count ) {

		case 1: return RedFormat;
		case 2: return RGFormat;
		case 3: return RGBAFormat;
		case 4: return RGBAFormat;

	}

}

function countToIntFormat( count ) {

	switch ( count ) {

		case 1: return RedIntegerFormat;
		case 2: return RGIntegerFormat;
		case 3: return RGBAIntegerFormat;
		case 4: return RGBAIntegerFormat;

	}

}

class VertexAttributeTexture extends DataTexture {

	constructor() {

		super();
		this.minFilter = NearestFilter;
		this.magFilter = NearestFilter;
		this.generateMipmaps = false;
		this.overrideItemSize = null;
		this._forcedType = null;

	}

	updateFrom( attr ) {

		const overrideItemSize = this.overrideItemSize;
		const originalItemSize = attr.itemSize;
		const originalCount = attr.count;
		if ( overrideItemSize !== null ) {

			if ( ( originalItemSize * originalCount ) % overrideItemSize !== 0.0 ) {

				throw new Error( 'VertexAttributeTexture: overrideItemSize must divide evenly into buffer length.' );

			}

			attr.itemSize = overrideItemSize;
			attr.count = originalCount * originalItemSize / overrideItemSize;

		}

		const itemSize = attr.itemSize;
		const count = attr.count;
		const normalized = attr.normalized;
		const originalBufferCons = attr.array.constructor;
		const byteCount = originalBufferCons.BYTES_PER_ELEMENT;
		let targetType = this._forcedType;
		let finalStride = itemSize;

		// derive the type of texture this should be in the shader
		if ( targetType === null ) {

			switch ( originalBufferCons ) {

				case Float32Array:
					targetType = FloatType;
					break;

				case Uint8Array:
				case Uint16Array:
				case Uint32Array:
					targetType = UnsignedIntType;
					break;

				case Int8Array:
				case Int16Array:
				case Int32Array:
					targetType = IntType;
					break;

			}

		}

		// get the target format to store the texture as
		let type, format, normalizeValue, targetBufferCons;
		let internalFormat = countToStringFormat( itemSize );
		switch ( targetType ) {

			case FloatType:
				normalizeValue = 1.0;
				format = countToFormat( itemSize );

				if ( normalized && byteCount === 1 ) {

					targetBufferCons = originalBufferCons;
					internalFormat += '8';

					if ( originalBufferCons === Uint8Array ) {

						type = UnsignedByteType;

					} else {

						type = ByteType;
						internalFormat += '_SNORM';

					}

				} else {

					targetBufferCons = Float32Array;
					internalFormat += '32F';
					type = FloatType;

				}

				break;

			case IntType:
				internalFormat += byteCount * 8 + 'I';
				normalizeValue = normalized ? Math.pow( 2, originalBufferCons.BYTES_PER_ELEMENT * 8 - 1 ) : 1.0;
				format = countToIntFormat( itemSize );

				if ( byteCount === 1 ) {

					targetBufferCons = Int8Array;
					type = ByteType;

				} else if ( byteCount === 2 ) {

					targetBufferCons = Int16Array;
					type = ShortType;

				} else {

					targetBufferCons = Int32Array;
					type = IntType;

				}

				break;

			case UnsignedIntType:
				internalFormat += byteCount * 8 + 'UI';
				normalizeValue = normalized ? Math.pow( 2, originalBufferCons.BYTES_PER_ELEMENT * 8 - 1 ) : 1.0;
				format = countToIntFormat( itemSize );

				if ( byteCount === 1 ) {

					targetBufferCons = Uint8Array;
					type = UnsignedByteType;

				} else if ( byteCount === 2 ) {

					targetBufferCons = Uint16Array;
					type = UnsignedShortType;

				} else {

					targetBufferCons = Uint32Array;
					type = UnsignedIntType;

				}

				break;

		}

		// there will be a mismatch between format length and final length because
		// RGBFormat and RGBIntegerFormat was removed
		if ( finalStride === 3 && ( format === RGBAFormat || format === RGBAIntegerFormat ) ) {

			finalStride = 4;

		}

		// copy the data over to the new texture array
		const dimension = Math.ceil( Math.sqrt( count ) ) || 1;
		const length = finalStride * dimension * dimension;
		const dataArray = new targetBufferCons( length );

		// temporarily set the normalized state to false since we have custom normalization logic
		const originalNormalized = attr.normalized;
		attr.normalized = false;
		for ( let i = 0; i < count; i ++ ) {

			const ii = finalStride * i;
			dataArray[ ii ] = attr.getX( i ) / normalizeValue;

			if ( itemSize >= 2 ) {

				dataArray[ ii + 1 ] = attr.getY( i ) / normalizeValue;

			}

			if ( itemSize >= 3 ) {

				dataArray[ ii + 2 ] = attr.getZ( i ) / normalizeValue;

				if ( finalStride === 4 ) {

					dataArray[ ii + 3 ] = 1.0;

				}

			}

			if ( itemSize >= 4 ) {

				dataArray[ ii + 3 ] = attr.getW( i ) / normalizeValue;

			}

		}

		attr.normalized = originalNormalized;

		this.internalFormat = internalFormat;
		this.format = format;
		this.type = type;
		this.image.width = dimension;
		this.image.height = dimension;
		this.image.data = dataArray;
		this.needsUpdate = true;
		this.dispose();

		attr.itemSize = originalItemSize;
		attr.count = originalCount;

	}

}

class UIntVertexAttributeTexture extends VertexAttributeTexture {

	constructor() {

		super();
		this._forcedType = UnsignedIntType;

	}

}

class IntVertexAttributeTexture extends VertexAttributeTexture {

	constructor() {

		super();
		this._forcedType = IntType;

	}


}

class FloatVertexAttributeTexture extends VertexAttributeTexture {

	constructor() {

		super();
		this._forcedType = FloatType;

	}

}

class MeshBVHUniformStruct {

	constructor() {

		this.index = new UIntVertexAttributeTexture();
		this.position = new FloatVertexAttributeTexture();
		this.bvhBounds = new DataTexture();
		this.bvhContents = new DataTexture();
		this._cachedIndexAttr = null;

		this.index.overrideItemSize = 3;

	}

	updateFrom( bvh ) {

		const { geometry } = bvh;
		bvhToTextures( bvh, this.bvhBounds, this.bvhContents );

		this.position.updateFrom( geometry.attributes.position );

		// dereference a new index attribute if we're using indirect storage
		if ( bvh.indirect ) {

			const indirectBuffer = bvh._indirectBuffer;
			if (
				this._cachedIndexAttr === null ||
				this._cachedIndexAttr.count !== indirectBuffer.length
			) {

				if ( geometry.index ) {

					this._cachedIndexAttr = geometry.index.clone();

				} else {

					const array = getIndexArray( getVertexCount( geometry ) );
					this._cachedIndexAttr = new BufferAttribute( array, 1, false );

				}

			}

			dereferenceIndex( geometry, indirectBuffer, this._cachedIndexAttr );
			this.index.updateFrom( this._cachedIndexAttr );

		} else {

			this.index.updateFrom( geometry.index );

		}

	}

	dispose() {

		const { index, position, bvhBounds, bvhContents } = this;

		if ( index ) index.dispose();
		if ( position ) position.dispose();
		if ( bvhBounds ) bvhBounds.dispose();
		if ( bvhContents ) bvhContents.dispose();

	}

}

function dereferenceIndex( geometry, indirectBuffer, target ) {

	const unpacked = target.array;
	const indexArray = geometry.index ? geometry.index.array : null;
	for ( let i = 0, l = indirectBuffer.length; i < l; i ++ ) {

		const i3 = 3 * i;
		const v3 = 3 * indirectBuffer[ i ];
		for ( let c = 0; c < 3; c ++ ) {

			unpacked[ i3 + c ] = indexArray ? indexArray[ v3 + c ] : v3 + c;

		}

	}

}

function bvhToTextures( bvh, boundsTexture, contentsTexture ) {

	const roots = bvh._roots;

	if ( roots.length !== 1 ) {

		throw new Error( 'MeshBVHUniformStruct: Multi-root BVHs not supported.' );

	}

	const root = roots[ 0 ];
	const uint16Array = new Uint16Array( root );
	const uint32Array = new Uint32Array( root );
	const float32Array = new Float32Array( root );

	// Both bounds need two elements per node so compute the height so it's twice as long as
	// the width so we can expand the row by two and still have a square texture
	const nodeCount = root.byteLength / BYTES_PER_NODE;
	const boundsDimension = 2 * Math.ceil( Math.sqrt( nodeCount / 2 ) );
	const boundsArray = new Float32Array( 4 * boundsDimension * boundsDimension );

	const contentsDimension = Math.ceil( Math.sqrt( nodeCount ) );
	const contentsArray = new Uint32Array( 2 * contentsDimension * contentsDimension );

	for ( let i = 0; i < nodeCount; i ++ ) {

		const nodeIndex32 = i * BYTES_PER_NODE / 4;
		const nodeIndex16 = nodeIndex32 * 2;
		const boundsIndex = BOUNDING_DATA_INDEX( nodeIndex32 );
		for ( let b = 0; b < 3; b ++ ) {

			boundsArray[ 8 * i + 0 + b ] = float32Array[ boundsIndex + 0 + b ];
			boundsArray[ 8 * i + 4 + b ] = float32Array[ boundsIndex + 3 + b ];

		}

		if ( IS_LEAF( nodeIndex16, uint16Array ) ) {

			const count = COUNT( nodeIndex16, uint16Array );
			const offset = OFFSET( nodeIndex32, uint32Array );

			const mergedLeafCount = 0xffff0000 | count;
			contentsArray[ i * 2 + 0 ] = mergedLeafCount;
			contentsArray[ i * 2 + 1 ] = offset;

		} else {

			const rightIndex = 4 * RIGHT_NODE( nodeIndex32, uint32Array ) / BYTES_PER_NODE;
			const splitAxis = SPLIT_AXIS( nodeIndex32, uint32Array );

			contentsArray[ i * 2 + 0 ] = splitAxis;
			contentsArray[ i * 2 + 1 ] = rightIndex;

		}

	}

	boundsTexture.image.data = boundsArray;
	boundsTexture.image.width = boundsDimension;
	boundsTexture.image.height = boundsDimension;
	boundsTexture.format = RGBAFormat;
	boundsTexture.type = FloatType;
	boundsTexture.internalFormat = 'RGBA32F';
	boundsTexture.minFilter = NearestFilter;
	boundsTexture.magFilter = NearestFilter;
	boundsTexture.generateMipmaps = false;
	boundsTexture.needsUpdate = true;
	boundsTexture.dispose();

	contentsTexture.image.data = contentsArray;
	contentsTexture.image.width = contentsDimension;
	contentsTexture.image.height = contentsDimension;
	contentsTexture.format = RGIntegerFormat;
	contentsTexture.type = UnsignedIntType;
	contentsTexture.internalFormat = 'RG32UI';
	contentsTexture.minFilter = NearestFilter;
	contentsTexture.magFilter = NearestFilter;
	contentsTexture.generateMipmaps = false;
	contentsTexture.needsUpdate = true;
	contentsTexture.dispose();

}

const _positionVector = /*@__PURE__*/ new Vector3();
const _normalVector = /*@__PURE__*/ new Vector3();
const _tangentVector = /*@__PURE__*/ new Vector3();
const _tangentVector4 = /*@__PURE__*/ new Vector4();

const _morphVector = /*@__PURE__*/ new Vector3();
const _temp = /*@__PURE__*/ new Vector3();

const _skinIndex = /*@__PURE__*/ new Vector4();
const _skinWeight = /*@__PURE__*/ new Vector4();
const _matrix = /*@__PURE__*/ new Matrix4();
const _boneMatrix = /*@__PURE__*/ new Matrix4();

// Confirms that the two provided attributes are compatible
function validateAttributes( attr1, attr2 ) {

	if ( ! attr1 && ! attr2 ) {

		return;

	}

	const sameCount = attr1.count === attr2.count;
	const sameNormalized = attr1.normalized === attr2.normalized;
	const sameType = attr1.array.constructor === attr2.array.constructor;
	const sameItemSize = attr1.itemSize === attr2.itemSize;

	if ( ! sameCount || ! sameNormalized || ! sameType || ! sameItemSize ) {

		throw new Error();

	}

}

// Clones the given attribute with a new compatible buffer attribute but no data
function createAttributeClone( attr, countOverride = null ) {

	const cons = attr.array.constructor;
	const normalized = attr.normalized;
	const itemSize = attr.itemSize;
	const count = countOverride === null ? attr.count : countOverride;

	return new BufferAttribute( new cons( itemSize * count ), itemSize, normalized );

}

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

// Adds the "matrix" multiplied by "scale" to "target"
function addScaledMatrix( target, matrix, scale ) {

	const targetArray = target.elements;
	const matrixArray = matrix.elements;
	for ( let i = 0, l = matrixArray.length; i < l; i ++ ) {

		targetArray[ i ] += matrixArray[ i ] * scale;

	}

}

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

// Modified version of BufferGeometryUtils.mergeBufferGeometries that ignores morph targets and updates a attributes in place
function mergeBufferGeometries( geometries, options = { useGroups: false, updateIndex: false, skipAttributes: [] }, targetGeometry = new BufferGeometry() ) {

	const isIndexed = geometries[ 0 ].index !== null;
	const { useGroups = false, updateIndex = false, skipAttributes = [] } = options;

	const attributesUsed = new Set( Object.keys( geometries[ 0 ].attributes ) );
	const attributes = {};

	let offset = 0;

	targetGeometry.clearGroups();
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

			if ( attributes[ name ] === undefined ) {

				attributes[ name ] = [];

			}

			attributes[ name ].push( geometry.attributes[ name ] );
			attributesCount ++;

		}

		// ensure geometries have the same number of attributes
		if ( attributesCount !== attributesUsed.size ) {

			throw new Error( 'StaticGeometryGenerator: Make sure all geometries have the same number of attributes.' );

		}

		if ( useGroups ) {

			let count;
			if ( isIndexed ) {

				count = geometry.index.count;

			} else if ( geometry.attributes.position !== undefined ) {

				count = geometry.attributes.position.count;

			} else {

				throw new Error( 'StaticGeometryGenerator: The geometry must have either an index or a position attribute' );

			}

			targetGeometry.addGroup( offset, count, i );
			offset += count;

		}

	}

	// merge indices
	if ( isIndexed ) {

		let forceUpdateIndex = false;
		if ( ! targetGeometry.index ) {

			let indexCount = 0;
			for ( let i = 0; i < geometries.length; ++ i ) {

				indexCount += geometries[ i ].index.count;

			}

			targetGeometry.setIndex( new BufferAttribute( new Uint32Array( indexCount ), 1, false ) );
			forceUpdateIndex = true;

		}

		if ( updateIndex || forceUpdateIndex ) {

			const targetIndex = targetGeometry.index;
			let targetOffset = 0;
			let indexOffset = 0;
			for ( let i = 0; i < geometries.length; ++ i ) {

				const geometry = geometries[ i ];
				const index = geometry.index;
				if ( skipAttributes[ i ] !== true ) {

					for ( let j = 0; j < index.count; ++ j ) {

						targetIndex.setX( targetOffset, index.getX( j ) + indexOffset );
						targetOffset ++;

					}

				}

				indexOffset += geometry.attributes.position.count;

			}

		}

	}

	// merge attributes
	for ( const name in attributes ) {

		const attrList = attributes[ name ];
		if ( ! ( name in targetGeometry.attributes ) ) {

			let count = 0;
			for ( const key in attrList ) {

				count += attrList[ key ].count;

			}

			targetGeometry.setAttribute( name, createAttributeClone( attributes[ name ][ 0 ], count ) );

		}

		const targetAttribute = targetGeometry.attributes[ name ];
		let offset = 0;
		for ( let i = 0, l = attrList.length; i < l; i ++ ) {

			const attr = attrList[ i ];
			if ( skipAttributes[ i ] !== true ) {

				copyAttributeContents( attr, targetAttribute, offset );

			}

			offset += attr.count;

		}

	}

	return targetGeometry;

}

function checkTypedArrayEquality( a, b ) {

	if ( a === null || b === null ) {

		return a === b;

	}

	if ( a.length !== b.length ) {

		return false;

	}

	for ( let i = 0, l = a.length; i < l; i ++ ) {

		if ( a[ i ] !== b[ i ] ) {

			return false;

		}

	}

	return true;

}

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

// Checks whether the geometry changed between this and last evaluation
class GeometryDiff {

	constructor( mesh ) {

		this.matrixWorld = new Matrix4();
		this.geometryHash = null;
		this.boneMatrices = null;
		this.primitiveCount = - 1;
		this.mesh = mesh;

		this.update();

	}

	update() {

		const mesh = this.mesh;
		const geometry = mesh.geometry;
		const skeleton = mesh.skeleton;
		const primitiveCount = ( geometry.index ? geometry.index.count : geometry.attributes.position.count ) / 3;
		this.matrixWorld.copy( mesh.matrixWorld );
		this.geometryHash = geometry.attributes.position.version;
		this.primitiveCount = primitiveCount;

		if ( skeleton ) {

			// ensure the bone matrix array is updated to the appropriate length
			if ( ! skeleton.boneTexture ) {

				skeleton.computeBoneTexture();

			}

			skeleton.update();

			// copy data if possible otherwise clone it
			const boneMatrices = skeleton.boneMatrices;
			if ( ! this.boneMatrices || this.boneMatrices.length !== boneMatrices.length ) {

				this.boneMatrices = boneMatrices.slice();

			} else {

				this.boneMatrices.set( boneMatrices );

			}

		} else {

			this.boneMatrices = null;

		}

	}

	didChange() {

		const mesh = this.mesh;
		const geometry = mesh.geometry;
		const primitiveCount = ( geometry.index ? geometry.index.count : geometry.attributes.position.count ) / 3;
		const identical =
			this.matrixWorld.equals( mesh.matrixWorld ) &&
			this.geometryHash === geometry.attributes.position.version &&
			checkTypedArrayEquality( mesh.skeleton && mesh.skeleton.boneMatrices || null, this.boneMatrices ) &&
			this.primitiveCount === primitiveCount;

		return ! identical;

	}

}

class StaticGeometryGenerator {

	constructor( meshes ) {

		if ( ! Array.isArray( meshes ) ) {

			meshes = [ meshes ];

		}

		const finalMeshes = [];
		meshes.forEach( object => {

			object.traverseVisible( c => {

				if ( c.isMesh ) {

					finalMeshes.push( c );

				}

			} );

		} );

		this.meshes = finalMeshes;
		this.useGroups = true;
		this.applyWorldTransforms = true;
		this.attributes = [ 'position', 'normal', 'color', 'tangent', 'uv', 'uv2' ];
		this._intermediateGeometry = new Array( finalMeshes.length ).fill().map( () => new BufferGeometry() );
		this._diffMap = new WeakMap();

	}

	getMaterials() {

		const materials = [];
		this.meshes.forEach( mesh => {

			if ( Array.isArray( mesh.material ) ) {

				materials.push( ...mesh.material );

			} else {

				materials.push( mesh.material );

			}

		} );
		return materials;

	}

	generate( targetGeometry = new BufferGeometry() ) {

		// track which attributes have been updated and which to skip to avoid unnecessary attribute copies
		let skipAttributes = [];
		const { meshes, useGroups, _intermediateGeometry, _diffMap } = this;
		for ( let i = 0, l = meshes.length; i < l; i ++ ) {

			const mesh = meshes[ i ];
			const geom = _intermediateGeometry[ i ];
			const diff = _diffMap.get( mesh );
			if ( ! diff || diff.didChange( mesh ) ) {

				this._convertToStaticGeometry( mesh, geom );
				skipAttributes.push( false );

				if ( ! diff ) {

					_diffMap.set( mesh, new GeometryDiff( mesh ) );

				} else {

					diff.update();

				}

			} else {

				skipAttributes.push( true );

			}

		}

		if ( _intermediateGeometry.length === 0 ) {

			// if there are no geometries then just create a fake empty geometry to provide
			targetGeometry.setIndex( null );

			// remove all geometry
			const attrs = targetGeometry.attributes;
			for ( const key in attrs ) {

				targetGeometry.deleteAttribute( key );

			}

			// create dummy attributes
			for ( const key in this.attributes ) {

				targetGeometry.setAttribute( this.attributes[ key ], new BufferAttribute( new Float32Array( 0 ), 4, false ) );

			}

		} else {

			mergeBufferGeometries( _intermediateGeometry, { useGroups, skipAttributes }, targetGeometry );

		}

		for ( const key in targetGeometry.attributes ) {

			targetGeometry.attributes[ key ].needsUpdate = true;

		}

		return targetGeometry;

	}

	_convertToStaticGeometry( mesh, targetGeometry = new BufferGeometry() ) {

		const geometry = mesh.geometry;
		const applyWorldTransforms = this.applyWorldTransforms;
		const includeNormal = this.attributes.includes( 'normal' );
		const includeTangent = this.attributes.includes( 'tangent' );
		const attributes = geometry.attributes;
		const targetAttributes = targetGeometry.attributes;

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
		const normalMatrix = new Matrix3();
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
		for ( const i in this.attributes ) {

			const key = this.attributes[ i ];
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

}

const common_functions = /* glsl */`

// A stack of uint32 indices can can store the indices for
// a perfectly balanced tree with a depth up to 31. Lower stack
// depth gets higher performance.
//
// However not all trees are balanced. Best value to set this to
// is the trees max depth.
#ifndef BVH_STACK_DEPTH
#define BVH_STACK_DEPTH 60
#endif

#ifndef INFINITY
#define INFINITY 1e20
#endif

// Utilities
uvec4 uTexelFetch1D( usampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

ivec4 iTexelFetch1D( isampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

vec4 texelFetch1D( sampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

vec4 textureSampleBarycoord( sampler2D tex, vec3 barycoord, uvec3 faceIndices ) {

	return
		barycoord.x * texelFetch1D( tex, faceIndices.x ) +
		barycoord.y * texelFetch1D( tex, faceIndices.y ) +
		barycoord.z * texelFetch1D( tex, faceIndices.z );

}

void ndcToCameraRay(
	vec2 coord, mat4 cameraWorld, mat4 invProjectionMatrix,
	out vec3 rayOrigin, out vec3 rayDirection
) {

	// get camera look direction and near plane for camera clipping
	vec4 lookDirection = cameraWorld * vec4( 0.0, 0.0, - 1.0, 0.0 );
	vec4 nearVector = invProjectionMatrix * vec4( 0.0, 0.0, - 1.0, 1.0 );
	float near = abs( nearVector.z / nearVector.w );

	// get the camera direction and position from camera matrices
	vec4 origin = cameraWorld * vec4( 0.0, 0.0, 0.0, 1.0 );
	vec4 direction = invProjectionMatrix * vec4( coord, 0.5, 1.0 );
	direction /= direction.w;
	direction = cameraWorld * direction - origin;

	// slide the origin along the ray until it sits at the near clip plane position
	origin.xyz += direction.xyz * near / dot( direction, lookDirection );

	rayOrigin = origin.xyz;
	rayDirection = direction.xyz;

}
`;

// Distance to Point
const bvh_distance_functions = /* glsl */`

float dot2( vec3 v ) {

	return dot( v, v );

}

// https://www.shadertoy.com/view/ttfGWl
vec3 closestPointToTriangle( vec3 p, vec3 v0, vec3 v1, vec3 v2, out vec3 barycoord ) {

    vec3 v10 = v1 - v0;
    vec3 v21 = v2 - v1;
    vec3 v02 = v0 - v2;

	vec3 p0 = p - v0;
	vec3 p1 = p - v1;
	vec3 p2 = p - v2;

    vec3 nor = cross( v10, v02 );

    // method 2, in barycentric space
    vec3  q = cross( nor, p0 );
    float d = 1.0 / dot2( nor );
    float u = d * dot( q, v02 );
    float v = d * dot( q, v10 );
    float w = 1.0 - u - v;

	if( u < 0.0 ) {

		w = clamp( dot( p2, v02 ) / dot2( v02 ), 0.0, 1.0 );
		u = 0.0;
		v = 1.0 - w;

	} else if( v < 0.0 ) {

		u = clamp( dot( p0, v10 ) / dot2( v10 ), 0.0, 1.0 );
		v = 0.0;
		w = 1.0 - u;

	} else if( w < 0.0 ) {

		v = clamp( dot( p1, v21 ) / dot2( v21 ), 0.0, 1.0 );
		w = 0.0;
		u = 1.0-v;

	}

	barycoord = vec3( u, v, w );
    return u * v1 + v * v2 + w * v0;

}

float distanceToTriangles(
	// geometry info and triangle range
	sampler2D positionAttr, usampler2D indexAttr, uint offset, uint count,

	// point and cut off range
	vec3 point, float closestDistanceSquared,

	// outputs
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord, inout float side, inout vec3 outPoint
) {

	bool found = false;
	vec3 localBarycoord;
	for ( uint i = offset, l = offset + count; i < l; i ++ ) {

		uvec3 indices = uTexelFetch1D( indexAttr, i ).xyz;
		vec3 a = texelFetch1D( positionAttr, indices.x ).rgb;
		vec3 b = texelFetch1D( positionAttr, indices.y ).rgb;
		vec3 c = texelFetch1D( positionAttr, indices.z ).rgb;

		// get the closest point and barycoord
		vec3 closestPoint = closestPointToTriangle( point, a, b, c, localBarycoord );
		vec3 delta = point - closestPoint;
		float sqDist = dot2( delta );
		if ( sqDist < closestDistanceSquared ) {

			// set the output results
			closestDistanceSquared = sqDist;
			faceIndices = uvec4( indices.xyz, i );
			faceNormal = normalize( cross( a - b, b - c ) );
			barycoord = localBarycoord;
			outPoint = closestPoint;
			side = sign( dot( faceNormal, delta ) );

		}

	}

	return closestDistanceSquared;

}

float distanceSqToBounds( vec3 point, vec3 boundsMin, vec3 boundsMax ) {

	vec3 clampedPoint = clamp( point, boundsMin, boundsMax );
	vec3 delta = point - clampedPoint;
	return dot( delta, delta );

}

float distanceSqToBVHNodeBoundsPoint( vec3 point, sampler2D bvhBounds, uint currNodeIndex ) {

	uint cni2 = currNodeIndex * 2u;
	vec3 boundsMin = texelFetch1D( bvhBounds, cni2 ).xyz;
	vec3 boundsMax = texelFetch1D( bvhBounds, cni2 + 1u ).xyz;
	return distanceSqToBounds( point, boundsMin, boundsMax );

}

// use a macro to hide the fact that we need to expand the struct into separate fields
#define\
	bvhClosestPointToPoint(\
		bvh,\
		point, faceIndices, faceNormal, barycoord, side, outPoint\
	)\
	_bvhClosestPointToPoint(\
		bvh.position, bvh.index, bvh.bvhBounds, bvh.bvhContents,\
		point, faceIndices, faceNormal, barycoord, side, outPoint\
	)

float _bvhClosestPointToPoint(
	// bvh info
	sampler2D bvh_position, usampler2D bvh_index, sampler2D bvh_bvhBounds, usampler2D bvh_bvhContents,

	// point to check
	vec3 point,

	// output variables
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout vec3 outPoint
 ) {

	// stack needs to be twice as long as the deepest tree we expect because
	// we push both the left and right child onto the stack every traversal
	int ptr = 0;
	uint stack[ BVH_STACK_DEPTH ];
	stack[ 0 ] = 0u;

	float closestDistanceSquared = pow( 100000.0, 2.0 );
	bool found = false;
	while ( ptr > - 1 && ptr < BVH_STACK_DEPTH ) {

		uint currNodeIndex = stack[ ptr ];
		ptr --;

		// check if we intersect the current bounds
		float boundsHitDistance = distanceSqToBVHNodeBoundsPoint( point, bvh_bvhBounds, currNodeIndex );
		if ( boundsHitDistance > closestDistanceSquared ) {

			continue;

		}

		uvec2 boundsInfo = uTexelFetch1D( bvh_bvhContents, currNodeIndex ).xy;
		bool isLeaf = bool( boundsInfo.x & 0xffff0000u );
		if ( isLeaf ) {

			uint count = boundsInfo.x & 0x0000ffffu;
			uint offset = boundsInfo.y;
			closestDistanceSquared = distanceToTriangles(
				bvh_position, bvh_index, offset, count, point, closestDistanceSquared,

				// outputs
				faceIndices, faceNormal, barycoord, side, outPoint
			);

		} else {

			uint leftIndex = currNodeIndex + 1u;
			uint splitAxis = boundsInfo.x & 0x0000ffffu;
			uint rightIndex = boundsInfo.y;
			bool leftToRight = distanceSqToBVHNodeBoundsPoint( point, bvh_bvhBounds, leftIndex ) < distanceSqToBVHNodeBoundsPoint( point, bvh_bvhBounds, rightIndex );//rayDirection[ splitAxis ] >= 0.0;
			uint c1 = leftToRight ? leftIndex : rightIndex;
			uint c2 = leftToRight ? rightIndex : leftIndex;

			// set c2 in the stack so we traverse it later. We need to keep track of a pointer in
			// the stack while we traverse. The second pointer added is the one that will be
			// traversed first
			ptr ++;
			stack[ ptr ] = c2;
			ptr ++;
			stack[ ptr ] = c1;

		}

	}

	return sqrt( closestDistanceSquared );

}
`;

const bvh_ray_functions = /* glsl */`

#ifndef TRI_INTERSECT_EPSILON
#define TRI_INTERSECT_EPSILON 1e-5
#endif

// Raycasting
bool intersectsBounds( vec3 rayOrigin, vec3 rayDirection, vec3 boundsMin, vec3 boundsMax, out float dist ) {

	// https://www.reddit.com/r/opengl/comments/8ntzz5/fast_glsl_ray_box_intersection/
	// https://tavianator.com/2011/ray_box.html
	vec3 invDir = 1.0 / rayDirection;

	// find intersection distances for each plane
	vec3 tMinPlane = invDir * ( boundsMin - rayOrigin );
	vec3 tMaxPlane = invDir * ( boundsMax - rayOrigin );

	// get the min and max distances from each intersection
	vec3 tMinHit = min( tMaxPlane, tMinPlane );
	vec3 tMaxHit = max( tMaxPlane, tMinPlane );

	// get the furthest hit distance
	vec2 t = max( tMinHit.xx, tMinHit.yz );
	float t0 = max( t.x, t.y );

	// get the minimum hit distance
	t = min( tMaxHit.xx, tMaxHit.yz );
	float t1 = min( t.x, t.y );

	// set distance to 0.0 if the ray starts inside the box
	dist = max( t0, 0.0 );

	return t1 >= dist;

}

bool intersectsTriangle(
	vec3 rayOrigin, vec3 rayDirection, vec3 a, vec3 b, vec3 c,
	out vec3 barycoord, out vec3 norm, out float dist, out float side
) {

	// https://stackoverflow.com/questions/42740765/intersection-between-line-and-triangle-in-3d
	vec3 edge1 = b - a;
	vec3 edge2 = c - a;
	norm = cross( edge1, edge2 );

	float det = - dot( rayDirection, norm );
	float invdet = 1.0 / det;

	vec3 AO = rayOrigin - a;
	vec3 DAO = cross( AO, rayDirection );

	vec4 uvt;
	uvt.x = dot( edge2, DAO ) * invdet;
	uvt.y = - dot( edge1, DAO ) * invdet;
	uvt.z = dot( AO, norm ) * invdet;
	uvt.w = 1.0 - uvt.x - uvt.y;

	// set the hit information
	barycoord = uvt.wxy; // arranged in A, B, C order
	dist = uvt.z;
	side = sign( det );
	norm = side * normalize( norm );

	// add an epsilon to avoid misses between triangles
	uvt += vec4( TRI_INTERSECT_EPSILON );

	return all( greaterThanEqual( uvt, vec4( 0.0 ) ) );

}

bool intersectTriangles(
	// geometry info and triangle range
	sampler2D positionAttr, usampler2D indexAttr, uint offset, uint count,

	// ray
	vec3 rayOrigin, vec3 rayDirection,

	// outputs
	inout float minDistance, inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout float dist
) {

	bool found = false;
	vec3 localBarycoord, localNormal;
	float localDist, localSide;
	for ( uint i = offset, l = offset + count; i < l; i ++ ) {

		uvec3 indices = uTexelFetch1D( indexAttr, i ).xyz;
		vec3 a = texelFetch1D( positionAttr, indices.x ).rgb;
		vec3 b = texelFetch1D( positionAttr, indices.y ).rgb;
		vec3 c = texelFetch1D( positionAttr, indices.z ).rgb;

		if (
			intersectsTriangle( rayOrigin, rayDirection, a, b, c, localBarycoord, localNormal, localDist, localSide )
			&& localDist < minDistance
		) {

			found = true;
			minDistance = localDist;

			faceIndices = uvec4( indices.xyz, i );
			faceNormal = localNormal;

			side = localSide;
			barycoord = localBarycoord;
			dist = localDist;

		}

	}

	return found;

}

bool intersectsBVHNodeBounds( vec3 rayOrigin, vec3 rayDirection, sampler2D bvhBounds, uint currNodeIndex, out float dist ) {

	uint cni2 = currNodeIndex * 2u;
	vec3 boundsMin = texelFetch1D( bvhBounds, cni2 ).xyz;
	vec3 boundsMax = texelFetch1D( bvhBounds, cni2 + 1u ).xyz;
	return intersectsBounds( rayOrigin, rayDirection, boundsMin, boundsMax, dist );

}

// use a macro to hide the fact that we need to expand the struct into separate fields
#define\
	bvhIntersectFirstHit(\
		bvh,\
		rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist\
	)\
	_bvhIntersectFirstHit(\
		bvh.position, bvh.index, bvh.bvhBounds, bvh.bvhContents,\
		rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist\
	)

bool _bvhIntersectFirstHit(
	// bvh info
	sampler2D bvh_position, usampler2D bvh_index, sampler2D bvh_bvhBounds, usampler2D bvh_bvhContents,

	// ray
	vec3 rayOrigin, vec3 rayDirection,

	// output variables split into separate variables due to output precision
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout float dist
) {

	// stack needs to be twice as long as the deepest tree we expect because
	// we push both the left and right child onto the stack every traversal
	int ptr = 0;
	uint stack[ BVH_STACK_DEPTH ];
	stack[ 0 ] = 0u;

	float triangleDistance = INFINITY;
	bool found = false;
	while ( ptr > - 1 && ptr < BVH_STACK_DEPTH ) {

		uint currNodeIndex = stack[ ptr ];
		ptr --;

		// check if we intersect the current bounds
		float boundsHitDistance;
		if (
			! intersectsBVHNodeBounds( rayOrigin, rayDirection, bvh_bvhBounds, currNodeIndex, boundsHitDistance )
			|| boundsHitDistance > triangleDistance
		) {

			continue;

		}

		uvec2 boundsInfo = uTexelFetch1D( bvh_bvhContents, currNodeIndex ).xy;
		bool isLeaf = bool( boundsInfo.x & 0xffff0000u );

		if ( isLeaf ) {

			uint count = boundsInfo.x & 0x0000ffffu;
			uint offset = boundsInfo.y;

			found = intersectTriangles(
				bvh_position, bvh_index, offset, count,
				rayOrigin, rayDirection, triangleDistance,
				faceIndices, faceNormal, barycoord, side, dist
			) || found;

		} else {

			uint leftIndex = currNodeIndex + 1u;
			uint splitAxis = boundsInfo.x & 0x0000ffffu;
			uint rightIndex = boundsInfo.y;

			bool leftToRight = rayDirection[ splitAxis ] >= 0.0;
			uint c1 = leftToRight ? leftIndex : rightIndex;
			uint c2 = leftToRight ? rightIndex : leftIndex;

			// set c2 in the stack so we traverse it later. We need to keep track of a pointer in
			// the stack while we traverse. The second pointer added is the one that will be
			// traversed first
			ptr ++;
			stack[ ptr ] = c2;

			ptr ++;
			stack[ ptr ] = c1;

		}

	}

	return found;

}
`;

// Note that a struct cannot be used for the hit record including faceIndices, faceNormal, barycoord,
// side, and dist because on some mobile GPUS (such as Adreno) numbers are afforded less precision specifically
// when in a struct leading to inaccurate hit results. See KhronosGroup/WebGL#3351 for more details.
const bvh_struct_definitions = /* glsl */`
struct BVH {

	usampler2D index;
	sampler2D position;

	sampler2D bvhBounds;
	usampler2D bvhContents;

};
`;

var BVHShaderGLSL = /*#__PURE__*/Object.freeze({
	__proto__: null,
	bvh_distance_functions: bvh_distance_functions,
	bvh_ray_functions: bvh_ray_functions,
	bvh_struct_definitions: bvh_struct_definitions,
	common_functions: common_functions
});

const shaderStructs = bvh_struct_definitions;
const shaderDistanceFunction = bvh_distance_functions;
const shaderIntersectFunction = `
	${ common_functions }
	${ bvh_ray_functions }
`;

export { AVERAGE, BVHShaderGLSL, CENTER, CONTAINED, ExtendedTriangle, FloatVertexAttributeTexture, INTERSECTED, IntVertexAttributeTexture, MeshBVH, MeshBVHHelper, MeshBVHUniformStruct, NOT_INTERSECTED, OrientedBox, SAH, StaticGeometryGenerator, UIntVertexAttributeTexture, VertexAttributeTexture, acceleratedRaycast, computeBoundsTree, disposeBoundsTree, estimateMemoryInBytes, getBVHExtremes, getJSONStructure, getTriangleHitPointInfo, shaderDistanceFunction, shaderIntersectFunction, shaderStructs, validateBounds };
//# sourceMappingURL=index.module.js.map
