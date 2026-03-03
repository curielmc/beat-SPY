<template>
  <div class="min-h-screen bg-gradient-to-br from-base-300 to-base-100 py-12 px-4">
    <div class="max-w-3xl mx-auto">
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body prose max-w-none">
          <h1 class="text-center">Terms &amp; Conditions</h1>
          <p class="text-center text-base-content/60 text-sm">Last updated: March 3, 2026</p>

          <h2>1. Educational Purpose Only</h2>
          <p>
            Beat the S&amp;P 500 ("the App") is a <strong>simulated stock trading game</strong> designed
            exclusively for educational purposes. The App is intended to help students learn about
            investing, portfolio management, and financial markets in a risk-free environment.
          </p>
          <p>
            <strong>No real money is involved.</strong> All portfolios, cash balances, trades, and
            investment returns within the App are entirely fictional and simulated. Users start with a
            virtual balance of $100,000 that has no real-world monetary value.
          </p>

          <h2>2. Not Financial Advice</h2>
          <p>
            Nothing in this App constitutes financial advice, investment advice, trading advice, or any
            other sort of professional advice. The App does not recommend, endorse, or suggest the
            purchase or sale of any real securities. Any stock data, prices, or market information
            displayed in the App is provided for educational and illustrative purposes only and should
            not be relied upon for actual investment decisions.
          </p>
          <p>
            You should always consult a qualified financial advisor before making any real investment
            decisions.
          </p>

          <h2>3. No Guarantee of Accuracy</h2>
          <p>
            While the App uses real-time and historical market data from third-party providers, we make
            no warranties or representations regarding the accuracy, completeness, or timeliness of
            this data. Stock prices, company information, and other financial data may be delayed,
            inaccurate, or incomplete. Simulated trading results do not represent and are not indicative
            of actual results that could be achieved in real-world trading.
          </p>

          <h2>4. Assumption of No Risk</h2>
          <p>
            Because the App uses only simulated funds, there is no financial risk to users. However,
            the operators of the App shall not be held liable for any decisions made based on
            information or experience gained through the use of this App. Past simulated performance
            does not guarantee future real-world results.
          </p>

          <h2>5. User Eligibility &amp; Accounts</h2>
          <p>
            The App is designed for use by students, typically in a classroom setting under the
            supervision of an educator. By creating an account, you represent that:
          </p>
          <ul>
            <li>If you are under 18 years of age, you have the consent of a parent, guardian, or teacher to use this App.</li>
            <li>You will use the App in good faith and for its intended educational purposes.</li>
            <li>You will not attempt to disrupt, manipulate, or abuse the App or its systems.</li>
          </ul>

          <h2>6. User Conduct</h2>
          <p>Users agree not to:</p>
          <ul>
            <li>Use the App for any illegal or unauthorized purpose.</li>
            <li>Attempt to gain unauthorized access to other user accounts or App systems.</li>
            <li>Share account credentials with others.</li>
            <li>Post offensive, harmful, or inappropriate content through any social features of the App.</li>
          </ul>

          <h2>7. Privacy &amp; Data Collection</h2>
          <p>
            We collect only the information necessary to operate the App, including your name, email
            address, and simulated trading activity. We do not sell, share, or distribute personal
            information to third parties for marketing purposes. Your data is used solely to provide
            and improve the educational experience within the App.
          </p>
          <p>
            Teachers and administrators may have access to student trading activity and portfolio
            performance for educational assessment purposes.
          </p>

          <h2>8. Intellectual Property</h2>
          <p>
            All content, features, and functionality of the App are owned by the App operators and are
            protected by applicable intellectual property laws. Stock data is provided by third-party
            data providers and is subject to their respective terms of use.
          </p>

          <h2>9. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, the App and its operators, developers, teachers,
            and affiliated educational institutions shall not be liable for any indirect, incidental,
            special, consequential, or punitive damages arising out of or related to your use of the
            App. This includes, without limitation, any damages resulting from decisions made based on
            simulated trading experience.
          </p>

          <h2>10. Disclaimer of Warranties</h2>
          <p>
            The App is provided "as is" and "as available" without warranties of any kind, either
            express or implied. We do not warrant that the App will be uninterrupted, error-free, or
            free of harmful components.
          </p>

          <h2>11. Modifications</h2>
          <p>
            We reserve the right to modify these Terms &amp; Conditions at any time. Continued use of
            the App after changes are posted constitutes acceptance of the revised terms.
          </p>

          <h2>12. Governing Law</h2>
          <p>
            These Terms &amp; Conditions shall be governed by and construed in accordance with the laws
            of the United States, without regard to conflict of law principles.
          </p>

          <h2>13. Contact</h2>
          <p>
            If you have questions about these Terms &amp; Conditions, please contact your teacher or
            school administrator.
          </p>

          <div class="divider"></div>
          <p class="text-center text-sm text-base-content/50">
            By creating an account or using Beat the S&amp;P 500, you acknowledge that you have read,
            understood, and agree to these Terms &amp; Conditions.
          </p>

          <div class="text-center mt-4">
            <RouterLink to="/signup" class="btn btn-primary btn-sm">Back to Sign Up</RouterLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>
