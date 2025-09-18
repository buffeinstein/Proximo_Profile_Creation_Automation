import React, { useState } from "react";

const App = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Start button click handler
  const handleStart = async () => {
    setLoading(true);
    setMessage("");

    try {
      // Pre-parsed JSON (replace this with your actual pre-parsed JSON)
      const preParsedJson = [
        {
          company_name: "",
          role_title: "",
          role_duration: 0,
          role_description: "",
          role_seniority: "",
          role_industry: "",
          company_size: "",
          company_industry: "",
          role_story_1: "",
          role_story_2: "",
          role_story_3: "",
          metric_1: "",
          metric_2: "",
          metric_3: "",
        },
      ];

      // Send pre-parsed JSON to the backend
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preParsedJson),
      });

      if (response.ok) {
        setMessage("Process started successfully!");
      } else {
        const error = await response.json();
        setMessage(`Error: ${error.message}`);
      }
    } catch (err) {
      setMessage("Failed to start the process. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial, sans-serif" }}>
      {/* Left Side: User Profile */}
      <div style={{ flex: 1, padding: "20px", borderRight: "1px solid #ccc" }}>
        <h1>User Profile</h1>
        <div style={{ marginBottom: "20px" }}>
          <label>
            <strong>Name:</strong>
          </label>
          <input
            type="text"
            placeholder="Enter name"
            style={{
              display: "block",
              marginTop: "10px",
              padding: "10px",
              width: "100%",
              border: "1px solid #ccc",
              borderRadius: "5px",
            }}
          />
        </div>

        {/* Role Module */}
        <div style={{ marginBottom: "20px", border: "1px solid #ccc", padding: "10px", borderRadius: "5px" }}>
          <h2>Role Module</h2>
          <div style={{ marginBottom: "10px" }}>
            <label>
              <strong>Role:</strong>
            </label>
            <input
              type="text"
              placeholder="Enter role"
              style={{
                display: "block",
                marginTop: "5px",
                padding: "10px",
                width: "100%",
                border: "1px solid #ccc",
                borderRadius: "5px",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label>
              <strong>Company:</strong>
            </label>
            <input
              type="text"
              placeholder="Enter company"
              style={{
                display: "block",
                marginTop: "5px",
                padding: "10px",
                width: "100%",
                border: "1px solid #ccc",
                borderRadius: "5px",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label>
              <strong>Duration:</strong>
            </label>
            <input
              type="number"
              placeholder="Enter duration (months)"
              style={{
                display: "block",
                marginTop: "5px",
                padding: "10px",
                width: "100%",
                border: "1px solid #ccc",
                borderRadius: "5px",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label>
              <strong>Role Seniority:</strong>
            </label>
            <input
              type="text"
              placeholder="Enter role seniority"
              style={{
                display: "block",
                marginTop: "5px",
                padding: "10px",
                width: "100%",
                border: "1px solid #ccc",
                borderRadius: "5px",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label>
              <strong>Role Industry:</strong>
            </label>
            <input
              type="text"
              placeholder="Enter role industry"
              style={{
                display: "block",
                marginTop: "5px",
                padding: "10px",
                width: "100%",
                border: "1px solid #ccc",
                borderRadius: "5px",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label>
              <strong>Company Size:</strong>
            </label>
            <input
              type="text"
              placeholder="Enter company size"
              style={{
                display: "block",
                marginTop: "5px",
                padding: "10px",
                width: "100%",
                border: "1px solid #ccc",
                borderRadius: "5px",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label>
              <strong>Company Industry:</strong>
            </label>
            <input
              type="text"
              placeholder="Enter company industry"
              style={{
                display: "block",
                marginTop: "5px",
                padding: "10px",
                width: "100%",
                border: "1px solid #ccc",
                borderRadius: "5px",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label>
              <strong>Role Description:</strong>
            </label>
            <textarea
              placeholder="Enter role description"
              style={{
                display: "block",
                marginTop: "5px",
                padding: "10px",
                width: "100%",
                height: "100px",
                border: "1px solid #ccc",
                borderRadius: "5px",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label>
              <strong>STAR Stories:</strong>
            </label>
            <textarea
              placeholder="Enter STAR story 1"
              style={{
                display: "block",
                marginTop: "5px",
                padding: "10px",
                width: "100%",
                height: "50px",
                border: "1px solid #ccc",
                borderRadius: "5px",
              }}
            />
            <textarea
              placeholder="Enter STAR story 2"
              style={{
                display: "block",
                marginTop: "5px",
                padding: "10px",
                width: "100%",
                height: "50px",
                border: "1px solid #ccc",
                borderRadius: "5px",
              }}
            />
            <textarea
              placeholder="Enter STAR story 3"
              style={{
                display: "block",
                marginTop: "5px",
                padding: "10px",
                width: "100%",
                height: "50px",
                border: "1px solid #ccc",
                borderRadius: "5px",
              }}
            />
          </div>
        </div>
      </div>

      {/* Right Side: Controls */}
      <div style={{ flex: 1, padding: "20px" }}>
        <h1>Controls</h1>
        <div style={{ marginBottom: "20px" }}>
          <label>
            <strong>Upload Resume (PDF):</strong>
          </label>
          <input type="file" accept="application/pdf" style={{ display: "block", marginTop: "10px" }} />
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label>
            <strong>Upload Job Link:</strong>
          </label>
          <input
            type="url"
            placeholder="Enter job link here"
            style={{
              display: "block",
              marginTop: "10px",
              padding: "10px",
              width: "100%",
              border: "1px solid #ccc",
              borderRadius: "5px",
            }}
          />
        </div>
        <button
          onClick={handleStart}
          disabled={loading}
          style={{
            padding: "10px 20px",
            backgroundColor: "#007BFF",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          {loading ? "Starting..." : "Start"}
        </button>
        {message && <p style={{ marginTop: "20px" }}>{message}</p>}
      </div>
    </div>
  );
};

export default App;