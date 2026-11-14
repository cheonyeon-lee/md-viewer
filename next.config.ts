import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // docs/**/*.md는 코드에서 import되지 않아 파일 트레이싱에서 자동으로 잡히지 않으므로
  // 배포(Vercel 등) 시 서버리스 함수 번들에 포함되도록 명시합니다.
  outputFileTracingIncludes: {
    "/": ["./docs/**/*"],
  },
};

export default nextConfig;
