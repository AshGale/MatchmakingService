// server/src/models/InvitationModel.js
import BaseModel from './BaseModel.js';

class InvitationModel extends BaseModel {
  constructor() {
    super('invitations');
  }

  // Create a new invitation
  async create(senderId, recipientId) {
    // Check for existing active invitation
    const existing = await this.findActive(senderId, recipientId);
    
    if (existing) {
      return existing;
    }
    
    // Create new invitation with 5-minute expiration
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);
    
    return super.create({
      sender_id: senderId,
      recipient_id: recipientId,
      status: 'pending',
      created_at: new Date(),
      expires_at: expiresAt
    });
  }
  
  // Find active invitation between users
  async findActive(senderId, recipientId) {
    return this.db(this.tableName)
      .where({
        sender_id: senderId,
        recipient_id: recipientId,
        status: 'pending'
      })
      .andWhere('expires_at', '>', new Date())
      .first();
  }
  
  // Find all pending invitations for a user
  async findPendingForUser(userId) {
    return this.db(this.tableName)
      .select(
        `${this.tableName}.*`,
        'users.username as sender_username'
      )
      .join('users', `${this.tableName}.sender_id`, 'users.id')
      .where({
        [`${this.tableName}.recipient_id`]: userId,
        [`${this.tableName}.status`]: 'pending'
      })
      .andWhere(`${this.tableName}.expires_at`, '>', new Date())
      .orderBy(`${this.tableName}.created_at`, 'desc');
  }
  
  // Find all sent invitations by a user
  async findSentByUser(userId, includeExpired = false) {
    let query = this.db(this.tableName)
      .select(
        `${this.tableName}.*`,
        'users.username as recipient_username'
      )
      .join('users', `${this.tableName}.recipient_id`, 'users.id')
      .where(`${this.tableName}.sender_id`, userId);
      
    if (!includeExpired) {
      query = query.where(builder => {
        builder.where(`${this.tableName}.status`, '!=', 'expired')
          .orWhere(function() {
            this.where(`${this.tableName}.status`, 'pending')
              .andWhere(`${this.tableName}.expires_at`, '>', new Date());
          });
      });
    }
    
    return query.orderBy(`${this.tableName}.created_at`, 'desc');
  }
  
  // Update invitation status
  async updateStatus(id, status, userId) {
    const invitation = await this.findById(id);
    
    if (!invitation) {
      throw new Error('Invitation not found');
    }
    
    // Verify user is recipient for status updates
    if (status === 'accepted' || status === 'declined') {
      if (invitation.recipient_id !== userId) {
        throw new Error('Unauthorized to update invitation status');
      }
      // Ensure invitation hasn't expired
      if (invitation.status !== 'pending' || new Date(invitation.expires_at) <= new Date()) {
        throw new Error('Cannot respond to expired or non-pending invitation');
      }
    }
    
    // Verify user is sender for cancellations
    if (status === 'cancelled' && invitation.sender_id !== userId) {
      throw new Error('Only the sender can cancel an invitation');
    }
    
    return this.update(id, {
      status,
      responded_at: status !== 'pending' ? new Date() : null
    });
  }
  
  // Mark expired invitations
  async markExpired() {
    return this.db(this.tableName)
      .where('status', 'pending')
      .andWhere('expires_at', '<=', new Date())
      .update({ status: 'expired' });
  }
  
  // Get invitation by ID with user details
  async getWithUserDetails(id) {
    return this.db(this.tableName)
      .select(
        `${this.tableName}.*`,
        'sender.username as sender_username',
        'recipient.username as recipient_username'
      )
      .join('users as sender', `${this.tableName}.sender_id`, 'sender.id')
      .join('users as recipient', `${this.tableName}.recipient_id`, 'recipient.id')
      .where(`${this.tableName}.id`, id)
      .first();
  }
}

export default new InvitationModel();
