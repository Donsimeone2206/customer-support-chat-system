import {
  ChevronDown,
  FileText,
  GraduationCap,
  LayoutDashboard,
  PenBox,
  StarsIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { Button } from "./ui/button";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

const Header = () => {
  return (
    <header className="fixed top-0 w-full border-b bg-background/80 backdrop-blur-md z-50 supports-[backdrop-filter]:bg-background/60">
      <nav className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/">
        {/* Logo    change the Default behavior link */}
          <h1 className="text-2xl font-bold text-primary hover:text-primary/80 transition-colors duration-300">Chat Support System</h1>
        </Link>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <SignedIn>
            <Link href="/dashboard">
            Dashboard
            </Link>
            {/* Support Navigation */}
            <Link href="/support">
              Support
            </Link>
            {/* Visitor Navigation  */}
            <Link href="/visitor">
            Visitor
            </Link>
            {/* website navigation   */}
            <Link href="/website">
            Website
            </Link>
          </SignedIn>
        </div>
          <SignedOut>
            <SignInButton>
              <Button variant="outline">Sign In</Button>
            </SignInButton>
          </SignedOut>

          <SignedIn>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-10 h-10",
                  userButtonPopoverCard: "shadow-xl",
                  userPreviewMainIdentifier: "font-semibold",
                },
              }}
              afterSignOutUrl="/"
            />
          </SignedIn>
        
      </nav>
    </header>
  );
};

export default Header;
