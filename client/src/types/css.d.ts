/**
 * TypeScript declaration file for CSS and CSS Module imports
 * 
 * This file enables TypeScript to properly recognize imports of CSS files and CSS modules.
 * Without these declarations, TypeScript would show errors like:
 * 'Cannot find module './Component.module.css' or its corresponding type declarations'
 * 
 * For CSS modules, the import returns an object where:
 * - Keys are CSS class names defined in the CSS file
 * - Values are the unique generated class names used at runtime
 */

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.css' {
  const css: { [key: string]: string };
  export default css;
}

// Add additional style formats if needed in the project
// declare module '*.scss' { const classes: { [key: string]: string }; export default classes; }
// declare module '*.sass' { const classes: { [key: string]: string }; export default classes; }
// declare module '*.less' { const classes: { [key: string]: string }; export default classes; }
