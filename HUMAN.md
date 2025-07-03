HUMAN tasks

This is a document that keeps track of the human author's thoughts, TODOs, etc.

I've built this app to replace postach.io that went kaput.  Postachio was a blog engine that used Evernote notes as posts.  The key and elegant idea is to tag a note as _published_ to publish it!  Postachio used Evernote API to see the notes.

I've wanted to buid a next.js app in TypeScript to learn frontend development, since I heard about Prismic from Adam Murray.  The original team behind the Play Framework went on to build Prismic.

Vercel emerged as a platform of choice for deployment, so I asked Claude Code to build the whole thing on TypeScript, Next.js, and Vercel, using Postgres to store data and Google OAuth for login.

It brought in something called Prisma ORM to manage Postgres, and it turned out Vercel has Prisma integration that injects environment variables properly set.

I started developing locally and hit horrible OAuth loops where Google and Evernote auth collided.  
It took a tremendous amount of work to get that auth resolved.  Then Evernote access didn't work.  The SDK had not changed since 2017.  My keys from 2016 still worked!  Claude had a hard time learning how to get to Evernote.  I had to paste a pattern with noteStore and such to finally get through.  It kept trying to build direct access in Thrift and such.


After a while I resolved it and deployed to Vercel.  It turned out Evernote SDK behaved differently.  Got it working on Vercel.  Then it didn't work locally, and it had to create a binary logic -- it believes the functions are "wrapped"!  There's a doc it wrote about it in the HOWTO dorectory.

In fact there are many documents describing various solutions Claude made, all in the HOWTO.

WHat I need to learn:

* I had to use PRISMA_DATABASE_URL, not DATABASE_URL, as we need prisma+postgres:// protocol and only this one had it out of the three Prisma injects on Vercel.

* I createed a themes-dev branch with a separate database locally, need to see how to use separate databases for dev/prod.

* Vercel has dev/preview/prod, learn how to configure and use them, e.g. with the local matching dev.

* the auth solution was bespoke, wonder how it compares to SOTA

* my theme engine is amazing, I've asked for the vintage newspaper theme and Claude conjured it!  See how it actually works.