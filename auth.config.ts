import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import type { NextAuthConfig } from "next-auth"

export default{
    providers:[
        GitHub({
            clientId:process.env.AUTH_GITHUB_ID,
            clientSecret:process.env.AUTH_GITHUB_SECRET
        }),
        Google({
            clientId:process.env.AUTH_GOOGLE_ID,
            clientSecret:process.env.AUTH_GOOGLE_SECRET,

        })
    ]
} satisfies NextAuthConfig
// console.log("Google ID:", process.env.AUTH_GOOGLE_ID);
// console.log("Google Secret:", process.env.AUTH_GOOGLE_SECRET ? "Loaded" : "Missing");