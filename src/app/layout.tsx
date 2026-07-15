import type{Metadata}from"next";import"./globals.css";import{AppShell}from"@/components/layout/AppShell";
export const metadata:Metadata={title:"GitAtlas",description:"Git'in iç modelini görerek öğren."};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="tr" suppressHydrationWarning><body><a href="#main-content" className="skip-link">İçeriğe geç</a><AppShell>{children}</AppShell></body></html>}
