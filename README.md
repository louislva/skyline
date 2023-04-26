# Skyline

✨ Bring your own algorithm for Bluesky ✨

Skyline allows you to create your own AI algo-feeds OR use one of our pre-defined ones. [Try it out here!](https://skyline.gay/)

We have the following feeds:

- One post from each person you follow (let's not forget the shy poasters) 🙈
- Mutuals feed, to keep up with your friends 🤗
- Wholesome-only, to remind yourself of the best in humanity ❤️‍🔥
- What's Hot, but only in your preferred language 🌐
- Make your own algorithm! Just tell the AI what you want to see and what you don't 🤖

The way custom algorithms work in Skyline is via LLM embeddings. You can write a positive prompt "I want to see more of...", and posts matching will be brought to the top, and a negative prompt "I want to see less of..." which decides which posts to push to the bottom.

Ultimately, my interest in bring-your-own algorithm comes down to encouraging more love & kindness in the world. And I found this had a bigger impact than I thought it would! You can try this for yourself: does browsing Wholesome put you in a lighter, better mood than browsing Following?

In the long-term, I imagine safe MDMA-analogs in our coffee and other wild transhumanist stuff as the way, but in the short-term I think we'll be going the memetic route! That means kinder algorithms, kinder chatbots, new secular "religions", etc.

Everyone knows "social media makes you angry" - but maybe the tech is finally here for "social media makes you kinder"?

## Getting Started

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## To-do List

Here is the to-do list I use to track progress - feel free to contribute!

- [x] Project "Management"
  - [x] Share timelines
  - [x] Delete timelines
  - [x] Edit timelines
- [ ] Project "Smooth As Balls"
  - [x] Handle Retweets
  - [x] Cache threads to Local Storage
  - [x] Log out when session over
  - [x] Stay logged in across sessions
  - [x] Full context for wholesome feed
    - [x] `getThreadQuickAndDirty()` which will do it's best to recover the thread from (1) cache and (2) already-loaded posts
  - [ ] Refresh token usage for infinite sessions
  - [ ] Info about App Passwords in Login Page
- [ ] Project "Better Feeds"
  - [x] Language-specific What's Hot
  - [x] Reddit-like scoring algo: recency \* quality, with a minimum threshold to appear
  - [x] <u>Infinite feeds - query with the next cursor</u>
  - [ ] Automatic infinite feeds - when you're 6 posts away from bottom, load more
  - [ ] Custom feed settings:
    - [ ] Base: What's Hot / Mutuals / Following
    - [ ] Language filter: english / portuguese / japanese / farsi
    - [ ] Multiple prompts
    - [ ] Muted keywords
    - [ ] Sorting: Best / Combo / Recent
    - [ ] Show replies: Yes / All Followed / No
- [x] Project "Nice"
  - [x] Sticky timeline selection
  - [x] Dark mode
  - [x] <u>Auto-refresh feed</u>
- [ ] <u>Project "Full Client"</u>
  - [x] Like tweets
  - [x] Repost tweets
  - [ ] Post top level
  - [ ] Quote post tweets
  - [ ] Click and see threads
  - [ ] Post replies
  - [ ] Click and see profiles
  - [ ] Follow / unfollow people
  - [ ] Notifications
  - [ ] Links in Tweets
  - [ ] Click images to see expanded
- [ ] Project "Search" (We should have at least as advanced search as Twitter!)
- [ ] Project "Social Audio"
  - [ ] Skyspaces.net (https://staging.bsky.app/profile/geeken.tv) integration
- [ ] Project "DMs"
