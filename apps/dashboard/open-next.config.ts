const config = {
  default: {
    // Enable bundling to create a single-file server function.
    // Disable minification to avoid ENOENT errors with pnpm symlinks.
    bundle: true,
    minify: false,
    install: {
      packages: ['@swc/helpers'],
    },
  },
};

export default config;
