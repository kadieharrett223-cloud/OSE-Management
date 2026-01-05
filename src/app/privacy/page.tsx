export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-10 prose prose-slate">
      <h1>Privacy Policy</h1>
      <p>Last updated: January 5, 2026</p>

      <h2>1. What We Collect</h2>
      <ul>
        <li>Account and contact info you provide.</li>
        <li>Usage data (pages, features, device/browser metadata).</li>
        <li>Data you load into the app (e.g., pricing, invoices), and data from connected services like QuickBooks if you authorize.</li>
      </ul>

      <h2>2. How We Use Data</h2>
      <ul>
        <li>To provide, secure, and improve the Service.</li>
        <li>To support you and communicate about the Service.</li>
        <li>To integrate with third-party services you authorize.</li>
      </ul>

      <h2>3. Sharing</h2>
      <ul>
        <li>Service providers under contract (hosting, analytics, support) with appropriate safeguards.</li>
        <li>Third-party integrations you choose (e.g., QuickBooks) per their terms.</li>
        <li>As required by law or to protect rights, safety, and security.</li>
      </ul>

      <h2>4. Security</h2>
      <p>We use reasonable technical and organizational measures to protect data, but no system is 100% secure.</p>

      <h2>5. Data Retention</h2>
      <p>We retain data as needed for the Service and legal/compliance purposes, then delete or anonymize.</p>

      <h2>6. Your Choices</h2>
      <ul>
        <li>You can request access, correction, or deletion of your data where applicable.</li>
        <li>You can disconnect third-party integrations you authorized.</li>
      </ul>

      <h2>7. Children</h2>
      <p>The Service is not directed to children under 13.</p>

      <h2>8. Changes</h2>
      <p>We may update this policy; continued use means acceptance of changes.</p>

      <h2>9. Contact</h2>
      <p>Questions or requests: privacy@example.com.</p>
    </main>
  );
}
