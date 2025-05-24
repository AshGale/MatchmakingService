// server/src/models/BaseModel.js
import db from '../db.js';

class BaseModel {
  constructor(tableName) {
    this.tableName = tableName;
    this.db = db;
  }

  // Basic CRUD operations
  async findAll(options = {}) {
    const { limit, offset, orderBy, fields = '*', where = {} } = options;
    
    let query = this.db(this.tableName).select(fields);
    
    // Add where clauses
    Object.entries(where).forEach(([key, value]) => {
      query = query.where(key, value);
    });
    
    // Add ordering
    if (orderBy) {
      const { column, direction = 'asc' } = orderBy;
      query = query.orderBy(column, direction);
    }
    
    // Add pagination
    if (limit) {
      query = query.limit(limit);
      if (offset) {
        query = query.offset(offset);
      }
    }
    
    return query;
  }

  async findById(id, fields = '*') {
    return this.db(this.tableName)
      .select(fields)
      .where('id', id)
      .first();
  }

  async findOne(where, fields = '*') {
    return this.db(this.tableName)
      .select(fields)
      .where(where)
      .first();
  }

  async create(data) {
    return this.db(this.tableName)
      .insert(data)
      .returning('*')
      .then(rows => rows[0]);
  }

  async update(id, data) {
    return this.db(this.tableName)
      .where('id', id)
      .update(data)
      .returning('*')
      .then(rows => rows[0]);
  }

  async updateWhere(where, data) {
    return this.db(this.tableName)
      .where(where)
      .update(data)
      .returning('*');
  }

  async delete(id) {
    return this.db(this.tableName)
      .where('id', id)
      .del();
  }

  async deleteWhere(where) {
    return this.db(this.tableName)
      .where(where)
      .del();
  }

  // Transaction helper
  getTransactionProvider() {
    return this.db;
  }
}

export default BaseModel;
