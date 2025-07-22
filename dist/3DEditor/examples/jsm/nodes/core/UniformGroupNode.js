import Node from './Node.js';
import { addNodeClass } from './Node.js';

class UniformGroupNode extends Node {

	constructor( name, shared = false ) {

		super( 'string' );

		this.name = name;
		this.version = 0;

		this.shared = shared;

		this.isUniformGroup = true;

	}

	set needsUpdate( value ) {

		if ( value === true ) this.version ++;

	}

}

export const uniformGroup = ( name ) => new UniformGroupNode( name );
export const sharedUniformGroup = ( name ) => new UniformGroupNode( name, true );

export const frameGroup = sharedUniformGroup( 'frame' );
export const renderGroup = sharedUniformGroup( 'render' );
export const objectGroup = uniformGroup( 'object' );

export default UniformGroupNode;

addNodeClass( 'UniformGroupNode', UniformGroupNode );
