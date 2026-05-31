{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@marketer-pro/ui": ["../../packages/ui/src/index.ts"],
      "@marketer-pro/cinematic-engine": ["../../packages/cinematic-engine/src/index.ts"],
      "@marketer-pro/scene-engine": ["../../packages/scene-engine/src/index.ts"],
      "@marketer-pro/reward-engine": ["../../packages/reward-engine/src/index.ts"],
      "@marketer-pro/api-client": ["../../packages/api-client/src/index.ts"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
