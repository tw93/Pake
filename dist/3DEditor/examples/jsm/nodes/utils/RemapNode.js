import Node, { addNodeClass } from '../core/Node.js';
import { float, addNodeElement, nodeProxy } from '../shadernode/ShaderNode.js';

class RemapNode extends Node {

	constructor( node, inLowNode, inHighNode, outLowNode = float( 0 ), outHighNode = float( 1 ) ) {

		super();

		this.node = node;
		this.inLowNode = inLowNode;
		this.inHighNode = inHighNode;
		this.outLowNode = outLowNode;
		this.outHighNode = outHighNode;

		this.doClamp = true;

	}

	setup() {

		const { node, inLowNode, inHighNode, outLowNode, outHighNode, doClamp } = this;

		let t = node.sub( inLowNode ).div( inHighNode.sub( inLowNode ) );

		if ( doClamp === true ) t = t.clamp();

		return t.mul( outHighNode.sub( outLowNode ) ).add( outLowNode );

	}

}

export default RemapNode;

export const remap = nodeProxy( RemapNode, null, null, { doClamp: false } );
export const remapClamp = nodeProxy( RemapNode );

addNodeElement( 'remap', remap );
addNodeElement( 'remapClamp', remapClamp );

addNodeClass( 'RemapNode', RemapNode );
