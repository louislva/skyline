import { BORDER_300, INPUT_CLASSNAME } from "@/helpers/styling";
import { BskyAgent } from "@atproto/api";
import { useState } from "react";

export default function LoginScreen(props: { agent: BskyAgent }) {
  const { agent } = props;
  const login = async (username: string, password: string) => {
    setError(null);
    await agent
      .login({
        identifier: username,
        password: password,
      })
      .then((response) => {
        if (!response.success) {
          setError("Error");
        }
      })
      .catch((err) => {
        // Error
        setError(err.message);
      });
  };

  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<null | string>(null);

  return (
    <>
      <div className="min-h-screen w-full flex flex-col items-center justify-center pb-64 -mb-64">
        {/* The title */}
        <h1 className="text-3xl font-bold mb-6">Login to Bluesky</h1>
        {/* The login form */}
        <form
          className="flex flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            login(username.replace("@", ""), password);
          }}
        >
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={"p-2 rounded mb-4 " + INPUT_CLASSNAME}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={"p-2 rounded mb-4 " + INPUT_CLASSNAME}
          />
          <button
            type="submit"
            className="bg-blue-500 text-white p-2 rounded outline-none"
          >
            Login
          </button>
        </form>
        {error && <p className="text-red-500 mt-4">{error}</p>}
      </div>
      {/* Security policy section */}
      <SecurityInfo />
    </>
  );
}
function SecurityInfo() {
  return (
    <div
      className={
        "max-w-sm bg-white dark:bg-slate-900 p-4 rounded-xl border rounded-xl mb-8 " +
        BORDER_300
      }
    >
      <div className={"flex flex-row pb-2 border-b mb-2 " + BORDER_300}>
        <span className="material-icons mr-2 cursor-pointer">info</span>
        <div>Is this secure?</div>
      </div>
      <b>Yes!</b> Bluesky unfortunately doesn't have an OAuth login system yet,
      but we've taken the following measures to make sure your data is safe:
      <ul className="list-disc list-inside">
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
            the service here.
          </a>
        </li>
      </ul>
    </div>
  );
}
