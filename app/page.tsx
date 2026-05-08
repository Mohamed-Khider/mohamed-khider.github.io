"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("auth") === "true") {
      router.replace("/main");
    }
  }, [router]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (username === "admin" && password === "1234") {
      localStorage.setItem("auth", "true");
      router.push("/main");
      return;
    }

    alert("Invalid login");
  };

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 420, margin: "32px auto" }}>
        <div className="page-header">
          <div>
            <h1>Warehouse Login</h1>
            <p>Secure access for warehouse label generation.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="user">Username</label>
            <input
              id="user"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="pass">Password</label>
            <input
              id="pass"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <button className="primary-button full-width" type="submit">
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
