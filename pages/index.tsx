import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AtpAgentLoginOpts, BskyAgent } from "@atproto/api";
import { ProfileView } from "@atproto/api/dist/client/types/app/bsky/actor/defs";

// TYPES
type TimelineIdType = "chronological";

// HELPERS
function paginateUntil(
  fn: (cursor: string | undefined) => Promise<any[]>,
  cursor: string | null = null
) {}

// TIMELINE SCREEN
function TimelineScreen(props: {
  identifier: string;
  setIdentifier: (identifier: string | null) => void;
  agent: BskyAgent;
}) {
  const { identifier, setIdentifier, agent } = props;
  const [timelineId, setTimelineId] = useState<TimelineIdType>("chronological");
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      let follows: ProfileView[] = [];
      let cursor;
      for (let i = 0; i < 10; i++) {
        const response = await agent.getFollows({
          actor: identifier,
          cursor,
        });

        if (response.success) {
          follows = follows.concat(response.data.follows);
          if (!response.data.cursor || response.data.follows.length === 0) {
            break;
          }
          cursor = response.data.cursor;
        } else {
          // TODO: Handle error
          break;
        }
        console.log(i, cursor, follows);
      }
    })();
  }, []);

  return (
    <div>
      {/* <TimelinePicker timelineId={timelineId} setTimelineId={setTimelineId} />
      <Timeline posts={posts} /> */}
    </div>
  );
}

// LOGIN SCREEN
function LoginScreen(props: {
  setIdentifier: (identifier: string | null) => void;
  agent: BskyAgent;
}) {
  const { setIdentifier, agent } = props;
  const login = (username: string, password: string) => {
    setError(null);
    agent
      .login({
        identifier: username,
        password: password,
      })
      .then((response) => {
        if (response.success) {
          setIdentifier(response.data.did);
        } else {
          // Error
          setIdentifier(null);
          setError("Error");
        }
      })
      .catch((err) => {
        // Error
        setIdentifier(null);
        setError(err.message);
      });
  };

  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<null | string>(null);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      {/* An offset equal to the security info (ish) */}
      <div className="h-72" />
      {/* The title */}
      <h1 className="text-3xl font-bold mb-6">Login to Bluesky</h1>
      {/* The login form */}
      <form
        className="flex flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          login(username, password);
        }}
      >
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border border-gray-300 p-2 rounded mb-4"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-gray-300 p-2 rounded mb-4"
        />
        <button type="submit" className="bg-blue-500 text-white p-2 rounded">
          Login
        </button>
      </form>
      {error && <p className="text-red-500 mt-4">{error}</p>}
      {/* Security policy section */}
      <SecurityInfo />
    </div>
  );
}
function SecurityInfo() {
  return (
    <div className="mt-32 max-w-sm bg-white p-4 rounded-xl border rounded-xl">
      <div className="flex flex-row pb-2 border-b mb-2">
        <span className="material-icons mr-2 cursor-pointer">info</span>
        <div>Is this secure?</div>
      </div>
      <b>Yes!</b> Bluesky unfortunately doesn't have an OAuth login system yet,
      but we've taken the following measures to make sure your data is safe:
      <ul>
        <li>
          We don't send your password to our own servers. Every request is made
          directly from <i>your</i> browser to Bluesky's servers.
        </li>
        <li>
          We don't store your password anywhere. Not on the backend, not on the
          frontend, not in cookies, nowhere.
        </li>
        <li>
          If you don't trust us, you can always check the source code of{" "}
          <a
            href="https://github.com/louislva/skyline"
            className="text-blue-500"
            target="_blank"
          >
            this website here.
          </a>
        </li>
      </ul>
    </div>
  );
}

export default function Main() {
  const [identifier, setIdentifier] = useState<string | null>(null);
  const agent = useRef<BskyAgent>(
    new BskyAgent({
      service: "https://bsky.social",
    })
  ).current;

  return identifier ? (
    <TimelineScreen
      identifier={identifier}
      setIdentifier={setIdentifier}
      agent={agent}
    />
  ) : (
    <LoginScreen setIdentifier={setIdentifier} agent={agent} />
  );
}
