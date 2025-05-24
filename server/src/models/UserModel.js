// server/src/models/UserModel.js
import BaseModel from './BaseModel.js';
import argon2 from 'argon2';

class UserModel extends BaseModel {
  constructor() {
    super('users');
  }

  // User registration
  async register(username, email, password) {
    try {
      // Hash password using argon2
      const passwordHash = await argon2.hash(password);
      
      // Create user with hashed password
      return this.create({
        username,
        email,
        password_hash: passwordHash,
        elo_rating: 1000, // Default ELO rating
        created_at: new Date(),
        updated_at: new Date()
      });
    } catch (error) {
      throw new Error(`Failed to register user: ${error.message}`);
    }
  }

  // User authentication
  async authenticate(username, password) {
    try {
      // Find user by username
      const user = await this.findOne({ username });
      
      if (!user) {
        return { authenticated: false, message: 'User not found' };
      }
      
      // Verify password
      const passwordValid = await argon2.verify(user.password_hash, password);
      
      if (!passwordValid) {
        return { authenticated: false, message: 'Invalid password' };
      }
      
      // Don't include password_hash in returned user
      const { password_hash, ...userWithoutPassword } = user;
      
      return { 
        authenticated: true, 
        user: userWithoutPassword
      };
    } catch (error) {
      throw new Error(`Authentication error: ${error.message}`);
    }
  }

  // Get user profile
  async getProfile(userId) {
    try {
      return this.findById(userId, [
        'id', 
        'username', 
        'email', 
        'elo_rating', 
        'created_at', 
        'updated_at'
      ]);
    } catch (error) {
      throw new Error(`Failed to get user profile: ${error.message}`);
    }
  }

  // Update user profile
  async updateProfile(userId, profileData) {
    try {
      // Prevent updating sensitive fields
      const { password, password_hash, ...safeData } = profileData;
      
      // Add updated timestamp
      safeData.updated_at = new Date();
      
      return this.update(userId, safeData);
    } catch (error) {
      throw new Error(`Failed to update profile: ${error.message}`);
    }
  }

  // Update user password
  async updatePassword(userId, currentPassword, newPassword) {
    try {
      // Get user with password_hash
      const user = await this.findById(userId);
      
      if (!user) {
        return { success: false, message: 'User not found' };
      }
      
      // Verify current password
      const passwordValid = await argon2.verify(user.password_hash, currentPassword);
      
      if (!passwordValid) {
        return { success: false, message: 'Current password is incorrect' };
      }
      
      // Hash new password
      const newPasswordHash = await argon2.hash(newPassword);
      
      // Update password
      await this.update(userId, {
        password_hash: newPasswordHash,
        updated_at: new Date()
      });
      
      return { success: true, message: 'Password updated successfully' };
    } catch (error) {
      throw new Error(`Failed to update password: ${error.message}`);
    }
  }

  // Update ELO rating
  async updateElo(userId, newElo) {
    try {
      return this.update(userId, {
        elo_rating: newElo,
        updated_at: new Date()
      });
    } catch (error) {
      throw new Error(`Failed to update ELO rating: ${error.message}`);
    }
  }

  // Get user statistics
  async getStatistics(userId) {
    try {
      // This would typically join with game history tables
      // For now, we'll just return a placeholder
      const user = await this.findById(userId, ['id', 'username', 'elo_rating']);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return {
        user,
        stats: {
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winRate: 0
        }
      };
    } catch (error) {
      throw new Error(`Failed to get user statistics: ${error.message}`);
    }
  }
}

export default new UserModel();
