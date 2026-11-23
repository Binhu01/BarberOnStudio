import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
 const baseUrl = "https://barberon.com.br";

 return {
 rules: [
 {
 userAgent: "*",
 allow: ["/", "/planos", "/login", "/cadastro", "/termos", "/privacidade"],
 disallow: ["/dashboard/", "/api/", "/_next/"],
 },
 ],
 sitemap: `${baseUrl}/sitemap.xml`,
 };
}