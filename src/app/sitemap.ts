import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
 const baseUrl = "https://barberon.com.br";
 const now = new Date();

 return [
 {
 url: baseUrl,
 lastModified: now,
 changeFrequency: "weekly",
 priority: 1,
 },
 {
 url: `${baseUrl}/planos`,
 lastModified: now,
 changeFrequency: "monthly",
 priority: 0.9,
 },
 {
 url: `${baseUrl}/cadastro`,
 lastModified: now,
 changeFrequency: "monthly",
 priority: 0.8,
 },
 {
 url: `${baseUrl}/login`,
 lastModified: now,
 changeFrequency: "monthly",
 priority: 0.5,
 },
 {
 url: `${baseUrl}/termos`,
 lastModified: now,
 changeFrequency: "yearly",
 priority: 0.3,
 },
 {
 url: `${baseUrl}/privacidade`,
 lastModified: now,
 changeFrequency: "yearly",
 priority: 0.3,
 },
 {
 url: `${baseUrl}/sobre`,
 lastModified: now,
 changeFrequency: "monthly",
 priority: 0.6,
 },
 {
 url: `${baseUrl}/contato`,
 lastModified: now,
 changeFrequency: "monthly",
 priority: 0.6,
 },
 {
 url: `${baseUrl}/blog`,
 lastModified: now,
 changeFrequency: "weekly",
 priority: 0.7,
 },
 ];
}