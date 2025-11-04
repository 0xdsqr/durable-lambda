{ pkgs, ... }:
{
  projectRootFile = "flake.nix";

  programs.nixfmt.enable = true;
  programs.biome = {
    enable = true;
    settings = {
      formatter = {
        enabled = true;
        indentStyle = "space";
        indentWidth = 2;
      };
      javascript = {
        formatter = {
          quoteStyle = "double";
          semicolons = "asNeeded";
        };
      };
    };
  };

  # Configure biome for JS/TS/JSON in packages only
  settings.formatter.biome = {
    includes = [ "packages/**/*.{js,ts,jsx,tsx,json,jsonc}" ];
    excludes = [
      "node_modules/**"
      "dist/**"
      "build/**"
    ];
  };
}
