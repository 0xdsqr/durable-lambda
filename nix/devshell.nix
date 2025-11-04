{ nixpkgs, system }:
let
  pkgs = import nixpkgs { inherit system; };
  nodePkgs = pkgs.nodePackages; # access npm-based packages
in
{
  packages.${system}.default = [
    pkgs.bun
    pkgs.awscli2
  ];

  devShells.${system}.default = pkgs.mkShell {
    buildInputs = with pkgs; [
      # Core CLI utilities
      curl
      wget
      just

      # Nix tooling
      nixfmt-rfc-style
      nixfmt-tree
      statix
      deadnix
      nil

      # Language/runtime
      bun
      nodejs_22

      # AWS tooling
      awscli2
      nodePkgs.aws-cdk

      # Shell experience
      starship
    ];

    shellHook = ''
      # Initialize starship
      if [[ -n "$ZSH_VERSION" ]]; then
        eval "$(starship init zsh)"
      else
        eval "$(starship init bash)"
      fi

      echo ""
      echo "🪄 Durable Lambda Dev Shell"
      echo "────────────────────────────"
      echo "Bun:        $(bun --version)"
      echo "Node:       $(node --version)"
      echo "AWS CLI:    $(aws --version)"
      echo "AWS CDK:    $(cdk --version)"
      echo "────────────────────────────"
      echo "🚀 Ready for CDK deploys!"
      echo ""
    '';

    preferLocalBuild = true;
    shell = "${pkgs.zsh}/bin/zsh";
  };
}
