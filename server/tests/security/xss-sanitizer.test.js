// server/tests/security/xss-sanitizer.test.js
import chai from 'chai';
import { sanitizeString, sanitizeObject, sanitizeRequestBody } from '../../src/utils/sanitize.js';

const { expect } = chai;

describe('XSS Sanitization Tests', () => {
  describe('String Sanitization', () => {
    it('should escape HTML in strings', () => {
      const input = '<script>alert("XSS")</script>';
      const sanitized = sanitizeString(input);
      expect(sanitized).to.equal('&lt;script&gt;alert("XSS")&lt;/script&gt;');
    });

    it('should handle non-string values correctly', () => {
      expect(sanitizeString(null)).to.equal(null);
      expect(sanitizeString(undefined)).to.equal(undefined);
      expect(sanitizeString(123)).to.equal(123);
      expect(sanitizeString(true)).to.equal(true);
    });
  });

  describe('Object Sanitization', () => {
    it('should sanitize string properties in an object', () => {
      const input = {
        name: '<b>User</b>',
        message: '<script>alert("XSS")</script>',
        id: 123,
        isActive: true
      };

      const expected = {
        name: '&lt;b&gt;User&lt;/b&gt;',
        message: '&lt;script&gt;alert("XSS")&lt;/script&gt;',
        id: 123,
        isActive: true
      };

      expect(sanitizeObject(input)).to.deep.equal(expected);
    });

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: '<b>Admin</b>',
          role: '<script>doEvil()</script>'
        },
        meta: {
          isValid: true
        }
      };

      const expected = {
        user: {
          name: '&lt;b&gt;Admin&lt;/b&gt;',
          role: '&lt;script&gt;doEvil()&lt;/script&gt;'
        },
        meta: {
          isValid: true
        }
      };

      expect(sanitizeObject(input)).to.deep.equal(expected);
    });

    it('should sanitize arrays of strings', () => {
      const input = ['<b>Bold</b>', '<i>Italic</i>', 'Normal'];
      const expected = ['&lt;b&gt;Bold&lt;/b&gt;', '&lt;i&gt;Italic&lt;/i&gt;', 'Normal'];

      expect(sanitizeObject(input)).to.deep.equal(expected);
    });

    it('should sanitize objects in arrays', () => {
      const input = [
        { name: '<b>User1</b>' },
        { name: '<script>alert(1)</script>' }
      ];

      const expected = [
        { name: '&lt;b&gt;User1&lt;/b&gt;' },
        { name: '&lt;script&gt;alert(1)&lt;/script&gt;' }
      ];

      expect(sanitizeObject(input)).to.deep.equal(expected);
    });

    it('should handle complex nested structures', () => {
      const input = {
        users: [
          { name: '<b>User1</b>', meta: { html: '<div>Content</div>' } },
          { name: 'User2', tags: ['<script>', '<style>'] }
        ],
        settings: {
          theme: '<style>.evil{}</style>',
          enabled: true
        }
      };

      const expected = {
        users: [
          { name: '&lt;b&gt;User1&lt;/b&gt;', meta: { html: '&lt;div&gt;Content&lt;/div&gt;' } },
          { name: 'User2', tags: ['&lt;script&gt;', '&lt;style&gt;'] }
        ],
        settings: {
          theme: '&lt;style&gt;.evil{}&lt;/style&gt;',
          enabled: true
        }
      };

      expect(sanitizeObject(input)).to.deep.equal(expected);
    });
  });

  describe('Request Middleware', () => {
    it('should sanitize request body, params, and query', () => {
      // Mock request and response
      const req = {
        body: {
          name: '<script>alert("XSS")</script>',
          message: 'Hello <b>world</b>'
        },
        params: {
          id: '<img src="x" onerror="alert(1)">'
        },
        query: {
          search: '<iframe src="evil.com"></iframe>'
        }
      };
      
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };
      
      // Apply middleware
      sanitizeRequestBody(req, res, next);
      
      // Check results
      expect(req.body.name).to.equal('&lt;script&gt;alert("XSS")&lt;/script&gt;');
      expect(req.body.message).to.equal('Hello &lt;b&gt;world&lt;/b&gt;');
      expect(req.params.id).to.equal('&lt;img src="x" onerror="alert(1)"&gt;');
      expect(req.query.search).to.equal('&lt;iframe src="evil.com"&gt;&lt;/iframe&gt;');
      expect(nextCalled).to.be.true;
    });
  });
});
