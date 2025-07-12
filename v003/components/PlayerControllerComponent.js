import { Component } from '../core/Component.js';

export class PlayerControllerComponent extends Component {
    constructor() {
        super();
        this.moveSpeed = 5.0;
        this.jumpForce = 10.0;
        this.isGrounded = false;
        this.isJumping = false;
        this.jumpVelocity = 0;
        this.canDoubleJump = false;
        this.hasDoubleJumped = false;
        this.groundCheckDistance = 0.1;
        this.active = true;
    }
    
    jump() {
        if (this.isGrounded && !this.isJumping) {
            this.isJumping = true;
            this.jumpVelocity = this.jumpForce;
            this.hasDoubleJumped = false;
            return true;
        } else if (this.canDoubleJump && !this.hasDoubleJumped && this.isJumping) {
            this.jumpVelocity = this.jumpForce * 0.8;
            this.hasDoubleJumped = true;
            return true;
        }
        return false;
    }
    
    land() {
        this.isGrounded = true;
        this.isJumping = false;
        this.jumpVelocity = 0;
        this.hasDoubleJumped = false;
    }
    
    serialize() {
        return {
            moveSpeed: this.moveSpeed,
            jumpForce: this.jumpForce,
            canDoubleJump: this.canDoubleJump,
            groundCheckDistance: this.groundCheckDistance,
            active: this.active
        };
    }
    
    deserialize(data) {
        this.moveSpeed = data.moveSpeed || 5.0;
        this.jumpForce = data.jumpForce || 10.0;
        this.canDoubleJump = data.canDoubleJump || false;
        this.groundCheckDistance = data.groundCheckDistance || 0.1;
        this.active = data.active !== false;
    }
}