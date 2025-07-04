'use client'

import Link from 'next/link'

export default function DomainInstructionsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Custom Domain Setup</h1>
              <p className="text-gray-600 mt-1">Connect your own domain to your FromCafe blog</p>
            </div>
            <Link
              href="/"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-6 text-gray-900">How to Connect Your Custom Domain</h2>
          
          <div className="prose max-w-none">
            <p className="text-gray-700 mb-6">
              Follow these steps to connect your custom domain (like <code className="bg-gray-100 px-2 py-1 rounded">yourblog.com</code>) to your FromCafe blog.
            </p>

            <div className="space-y-8">
              <div className="border-l-4 border-blue-500 pl-6">
                <h3 className="text-xl font-semibold mb-3 text-gray-900">Step 1: Configure DNS Settings</h3>
                <p className="text-gray-700 mb-4">
                  In your domain registrar&apos;s DNS settings (GoDaddy, Namecheap, Cloudflare, etc.), add the following records:
                </p>
                
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <h4 className="font-semibold mb-3 text-gray-900">For Root Domain (yourblog.com):</h4>
                  <div className="space-y-2 font-mono text-sm">
                    <div className="bg-white p-3 rounded border">
                      <div className="grid grid-cols-4 gap-4 text-xs text-gray-500 mb-1">
                        <span>Type</span>
                        <span>Name</span>
                        <span>Value</span>
                        <span>TTL</span>
                      </div>
                      <div className="grid grid-cols-4 gap-4">
                        <span className="font-semibold">A</span>
                        <span>@</span>
                        <span className="text-blue-600">76.76.19.61</span>
                        <span>300</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-3 text-gray-900">For WWW Subdomain (www.yourblog.com):</h4>
                  <div className="space-y-2 font-mono text-sm">
                    <div className="bg-white p-3 rounded border">
                      <div className="grid grid-cols-4 gap-4 text-xs text-gray-500 mb-1">
                        <span>Type</span>
                        <span>Name</span>
                        <span>Value</span>
                        <span>TTL</span>
                      </div>
                      <div className="grid grid-cols-4 gap-4">
                        <span className="font-semibold">CNAME</span>
                        <span>www</span>
                        <span className="text-blue-600">cname.vercel-dns.com</span>
                        <span>300</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">💡 Pro Tip</h4>
                  <p className="text-blue-800 text-sm">
                    DNS changes can take up to 48 hours to propagate worldwide, but usually take effect within 1-2 hours.
                  </p>
                </div>
              </div>

              <div className="border-l-4 border-green-500 pl-6">
                <h3 className="text-xl font-semibold mb-3 text-gray-900">Step 2: Add Domain in FromCafe</h3>
                <p className="text-gray-700 mb-4">
                  Once your DNS is configured, add your domain to your FromCafe blog:
                </p>
                
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>Go to your <Link href="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link></li>
                  <li>Click on <strong>Settings</strong></li>
                  <li>Scroll to the <strong>Custom Domain</strong> section</li>
                  <li>Enter your domain (e.g., <code className="bg-gray-100 px-1 rounded">yourblog.com</code>)</li>
                  <li>Click <strong>Save Changes</strong></li>
                </ol>

                <div className="mt-4 p-4 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2">✅ Verification</h4>
                  <p className="text-green-800 text-sm">
                    We&apos;ll automatically verify your domain and issue an SSL certificate. This process usually takes 5-10 minutes.
                  </p>
                </div>
              </div>

              <div className="border-l-4 border-yellow-500 pl-6">
                <h3 className="text-xl font-semibold mb-3 text-gray-900">Step 3: Test Your Domain</h3>
                <p className="text-gray-700 mb-4">
                  After both DNS and FromCafe setup are complete:
                </p>
                
                <ul className="list-disc list-inside space-y-2 text-gray-700">
                  <li>Visit your custom domain in a browser</li>
                  <li>Verify that your blog loads correctly</li>
                  <li>Check that HTTPS is working (look for the lock icon)</li>
                  <li>Test that all links and navigation work properly</li>
                </ul>
              </div>
            </div>

            <div className="mt-8 p-6 bg-gray-50 rounded-lg">
              <h3 className="text-xl font-semibold mb-4 text-gray-900">Common DNS Provider Instructions</h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2 text-gray-900">Cloudflare</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                    <li>Log in to Cloudflare dashboard</li>
                    <li>Select your domain</li>
                    <li>Go to DNS tab</li>
                    <li>Add the records above</li>
                    <li>Ensure proxy status is &quot;DNS only&quot; (gray cloud)</li>
                  </ol>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2 text-gray-900">GoDaddy</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                    <li>Log in to GoDaddy</li>
                    <li>Go to Domain Manager</li>
                    <li>Click DNS next to your domain</li>
                    <li>Add the A and CNAME records</li>
                    <li>Save changes</li>
                  </ol>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2 text-gray-900">Namecheap</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                    <li>Log in to Namecheap</li>
                    <li>Go to Domain List</li>
                    <li>Click Manage next to your domain</li>
                    <li>Go to Advanced DNS tab</li>
                    <li>Add the records above</li>
                  </ol>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2 text-gray-900">Google Domains</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                    <li>Log in to Google Domains</li>
                    <li>Select your domain</li>
                    <li>Go to DNS tab</li>
                    <li>Scroll to Custom records</li>
                    <li>Add the A and CNAME records</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="mt-8 p-6 bg-red-50 rounded-lg">
              <h3 className="text-xl font-semibold mb-4 text-red-900">Troubleshooting</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-red-900">Domain not working after 24 hours?</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-red-800 mt-2">
                    <li>Double-check your DNS records match exactly</li>
                    <li>Verify TTL is set to 300 or lower</li>
                    <li>Try using a DNS checker tool online</li>
                    <li>Contact your domain registrar&apos;s support</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold text-red-900">SSL certificate issues?</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-red-800 mt-2">
                    <li>Wait 10-15 minutes after domain verification</li>
                    <li>Try accessing with https:// explicitly</li>
                    <li>Clear your browser cache</li>
                    <li>Contact us if issues persist after 1 hour</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-8 p-6 bg-blue-50 rounded-lg">
              <h3 className="text-xl font-semibold mb-4 text-blue-900">Need Help?</h3>
              <p className="text-blue-800 mb-4">
                Having trouble setting up your custom domain? We&apos;re here to help!
              </p>
              <div className="space-y-2">
                <p className="text-blue-800">
                  <strong>Email:</strong> <a href="mailto:support@from.cafe" className="underline">support@from.cafe</a>
                </p>
                <p className="text-blue-800">
                  <strong>Include:</strong> Your domain name, DNS provider, and any error messages you see
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}