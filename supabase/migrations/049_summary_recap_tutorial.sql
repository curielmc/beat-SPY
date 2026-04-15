-- Add "Summary & Recap" training tutorial based on the Beat the S&P 500 final presentation
-- This is idempotent and can be run on fresh or existing databases.

DO $$
DECLARE
    tutorial_id uuid;
BEGIN
    INSERT INTO training_tutorials (title, slug, description, category, position, status)
    VALUES (
        'Summary & Recap',
        'summary-recap',
        'Reflect on your investment journey. Review your portfolio performance, articulate your investment thesis, prepare to present to your family, and celebrate what you''ve learned.',
        'investments',
        8,
        'active'
    )
    ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        category = EXCLUDED.category
    RETURNING id INTO tutorial_id;

    DELETE FROM training_steps WHERE training_tutorial_id = tutorial_id;

    INSERT INTO training_steps (training_tutorial_id, title, slug, content, position, duration_minutes)
    VALUES
    (tutorial_id, 'Portfolio Review: Your Performance vs. SPY', 'portfolio-review',
        '<div class="space-y-4">
            <div class="alert alert-info">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>Time to step back and reflect on what worked—and what didn''t.</span>
            </div>

            <h3 class="text-lg font-bold">Key Questions to Ask Yourself</h3>

            <div class="card bg-base-200 p-4 space-y-3">
                <div>
                    <h4 class="font-bold text-success">What Worked — and Why?</h4>
                    <p class="text-sm">Reflect on your top holdings. What thesis held up? What did the market reward? Look for patterns in your successful picks.</p>
                </div>
                <div class="divider my-2"></div>
                <div>
                    <h4 class="font-bold text-error">What Didn''t — and What Did You Learn?</h4>
                    <p class="text-sm">The market doesn''t care what you paid. Only what something is worth today. Losses teach discipline, humility, and rigor.</p>
                </div>
                <div class="divider my-2"></div>
                <div>
                    <h4 class="font-bold">The Real Lesson</h4>
                    <p class="text-sm"><i>"You learn more from your worst investment than your best one."</i> That worst trade forced you to think harder about risk, about your thesis, about discipline.</p>
                </div>
            </div>

            <h3 class="text-lg font-bold mt-6">How to Reflect</h3>
            <ul class="list-disc list-inside space-y-2">
                <li>Compare your fund returns to SPY (our benchmark)</li>
                <li>Identify your 2–3 best picks and explain why they worked</li>
                <li>Identify your 1–2 worst picks and extract the lessons</li>
                <li>Look for patterns: Did you bet on the right sectors? Did timing matter? Did you miss the bigger picture?</li>
            </ul>

            <div class="alert alert-success text-sm mt-6">
                <p><strong>Honest reflection beats perfect performance.</strong> The students who grow the most are the ones who are willing to say: "I was wrong, and here''s what I learned."</p>
            </div>
        </div>', 1, 8),

    (tutorial_id, 'Fund 6: Your Investment Thesis', 'investment-thesis',
        '<div class="space-y-4">
            <p class="text-lg"><i>"What do I believe about the world — and how does that guide where I put my money?"</i></p>

            <h3 class="text-lg font-bold">Why Fund 6 Matters</h3>
            <p>While Funds 1–5 were about learning the mechanics of stock picking and sector rotation, Fund 6 is about conviction. It''s your chance to express a real belief about where the world is headed.</p>

            <div class="card bg-base-200 p-4 space-y-4">
                <div>
                    <h4 class="font-bold">💡 Example Thesis: AI in Healthcare</h4>
                    <p class="text-sm">"I believe AI will transform hospitals. Diagnostic accuracy will improve, costs will fall, and patient outcomes will get better. So I want companies building those tools."</p>
                </div>
                <div>
                    <h4 class="font-bold">🥫 Example Thesis: Boring is Beautiful</h4>
                    <p class="text-sm">"People always need to eat. Stable food companies that pay dividends hold their value. Economic booms and busts don''t matter much to them—I want that stability."</p>
                </div>
                <div>
                    <h4 class="font-bold">☀️ Example Thesis: Clean Energy Future</h4>
                    <p class="text-sm">"Fossil fuels will be replaced over the next decade. Solar and battery companies are building the future. Regulation and climate change guarantee growth."</p>
                </div>
            </div>

            <h3 class="text-lg font-bold mt-6">Fund 6 Rules</h3>
            <div class="space-y-2">
                <div class="badge badge-outline">Any stock in any market</div>
                <div class="badge badge-outline">No maximum holdings (if you''re that convicted)</div>
                <div class="badge badge-outline">You must provide your rationale</div>
                <div class="badge badge-outline">Your thesis must guide every pick</div>
            </div>

            <h3 class="text-lg font-bold mt-6">How to Build Your Thesis</h3>
            <ol class="list-decimal list-inside space-y-2">
                <li><strong>Pick a belief:</strong> What do you think will happen in the world in the next 3–5 years?</li>
                <li><strong>Name companies that win:</strong> Which companies benefit if you''re right?</li>
                <li><strong>Do your research:</strong> Use DCF, P/E ratios, sector trends—whatever you trust</li>
                <li><strong>Write it down:</strong> Your thesis should be 2–3 sentences. Be specific, not vague.</li>
                <li><strong>Update it:</strong> As the market moves, does your thesis still hold? Be willing to change your mind.</li>
            </ol>

            <div class="alert alert-success text-sm mt-6">
                <p>Fund 6 is where you show what you truly believe. There are no "wrong" theses—only ones that the market tests.</p>
            </div>
        </div>', 2, 10),

    (tutorial_id, 'Your Assignment: Parent Presentation', 'parent-presentation',
        '<div class="space-y-4">
            <h3 class="text-xl font-bold">Prepare Three Things to Share</h3>
            <p>The best presentations are the ones that show real reflection. Be honest. Don''t hide from what didn''t work.</p>

            <div class="space-y-4 mt-6">
                <div class="card bg-base-100 border border-base-300">
                    <div class="card-body p-4">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="badge badge-success">1</span>
                            <h4 class="font-bold">🏆 Top 3 Takeaways</h4>
                        </div>
                        <p class="text-sm text-base-content/80">What are the three most important things you learned? What genuinely changed how you think about money?</p>
                        <p class="text-xs text-base-content/60 mt-2"><i>Examples: "I learned that P/E ratios tell you how expensive a stock is relative to earnings" or "Small companies can move faster than big ones."</i></p>
                    </div>
                </div>

                <div class="card bg-base-100 border border-base-300">
                    <div class="card-body p-4">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="badge badge-info">2</span>
                            <h4 class="font-bold">📈 Your Best Investment</h4>
                        </div>
                        <p class="text-sm text-base-content/80">Your proudest pick. Walk through your reasoning — why did you choose it, and why did it work?</p>
                        <p class="text-xs text-base-content/60 mt-2"><i>Tell the story: What attracted you? What did the market reward? Did luck play a role, or was it solid analysis?</i></p>
                    </div>
                </div>

                <div class="card bg-base-100 border border-base-300">
                    <div class="card-body p-4">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="badge badge-error">3</span>
                            <h4 class="font-bold">📉 Your Worst Investment</h4>
                        </div>
                        <p class="text-sm text-base-content/80">What went wrong — and what did it teach you? Don''t hide from it. That''s where the real lessons live.</p>
                        <p class="text-xs text-base-content/60 mt-2"><i>The courage to admit failure is a superpower. Show your parents that you can learn from losses better than from wins.</i></p>
                    </div>
                </div>
            </div>

            <blockquote class="border-l-4 border-primary pl-4 py-2 italic my-6">
                "Don''t be afraid to talk about what didn''t work. That''s where the real lessons are."
            </blockquote>

            <h3 class="text-lg font-bold mt-6">Presentation Tips</h3>
            <ul class="list-disc list-inside space-y-2">
                <li>Keep each section to 2–3 minutes. Respect your audience''s time.</li>
                <li>Use numbers. Show your parents real returns, sector allocations, and comparisons to SPY.</li>
                <li>Be honest about what you didn''t know. It shows maturity.</li>
                <li>End with excitement. What would you do differently with Fund 6?</li>
            </ul>
        </div>', 3, 10),

    (tutorial_id, 'The Competition 🏆', 'competition',
        '<div class="space-y-4">
            <h3 class="text-2xl font-bold">Your Fund 5 Portfolio Will Be Tracked for One Full Year</h3>
            <p class="text-lg">Head-to-head against each other and against the market itself.</p>

            <div class="alert alert-warning my-6">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span><strong>This is real.</strong> You''ll get to see whether your thesis holds up against the market — and against each other.</span>
            </div>

            <h3 class="text-lg font-bold mb-4">Three Ways to Win</h3>

            <div class="grid grid-cols-1 gap-4">
                <div class="card bg-success bg-opacity-10 border border-success">
                    <div class="card-body p-4">
                        <div class="flex items-center gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-success" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
                            <div>
                                <h4 class="font-bold">Best Fund Return</h4>
                                <p class="text-sm">Prize for the highest-returning individual fund after one year.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card bg-info bg-opacity-10 border border-info">
                    <div class="card-body p-4">
                        <div class="flex items-center gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-info" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                            <div>
                                <h4 class="font-bold">Best Group Overall</h4>
                                <p class="text-sm">Prize for the group whose combined funds perform the best collectively.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card bg-primary bg-opacity-10 border border-primary">
                    <div class="card-body p-4">
                        <div class="flex items-center gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" fill="currentColor" viewBox="0 0 24 24"><path d="M19 12h-2v-2h-2v2h-2v2h2v2h2v-2h2v-2zm-8-6H9v2H7V6h4zm0 4H9v2H7v-2h4zm0 4H9v2H7v-2h4zm8-8h-4v4h4V6zm0 4h-4v4h4v-4zM3 6h4v4H3V6zm0 4h4v4H3v-4zm0 4h4v4H3v-4z"/></svg>
                            <div>
                                <h4 class="font-bold">Beat the S&P 500</h4>
                                <p class="text-sm">Anyone who outperforms the index earns an award — and so does every friend who beats it.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="divider my-6"></div>

            <h3 class="text-lg font-bold">What This Means</h3>
            <ul class="list-disc list-inside space-y-2">
                <li><strong>Skin in the game:</strong> Your decisions matter. You''ll see real consequences—good and bad.</li>
                <li><strong>Long-term thinking:</strong> A year is long enough to separate luck from skill.</li>
                <li><strong>Healthy competition:</strong> You''ll learn from each other''s successes and failures.</li>
                <li><strong>Humility:</strong> Even the best investors have losing years. The S&P 500 is the standard for a reason.</li>
            </ul>

            <div class="alert alert-success text-sm mt-6">
                <p><strong>Remember:</strong> The point isn''t to get rich. It''s to learn how markets work, why they move, and how to think like an investor. Everything else is a bonus.</p>
            </div>
        </div>', 4, 10),

    (tutorial_id, 'Final Thoughts: You''ve Got This', 'final-thoughts',
        '<div class="space-y-6">
            <h2 class="text-2xl font-bold">You''ve Built Something Real</h2>

            <p class="text-lg">You didn''t just learn about investing in the abstract. You:</p>
            <ul class="list-disc list-inside space-y-2 text-base">
                <li>Researched real companies</li>
                <li>Made real allocation decisions</li>
                <li>Dealt with real market movements</li>
                <li>Experienced the emotional rollercoaster of gains and losses</li>
                <li>Learned to think like a portfolio manager</li>
            </ul>

            <div class="divider"></div>

            <h3 class="text-xl font-bold">The Road Ahead</h3>

            <div class="bg-gradient-to-r from-primary to-accent bg-opacity-10 p-6 rounded-lg space-y-3">
                <p><strong>Your Fund 6 thesis is the beginning, not the end.</strong> In a year, you''ll know whether your conviction was justified. But regardless of returns:</p>
                <ul class="list-disc list-inside space-y-2">
                    <li>You''ll understand why markets move</li>
                    <li>You''ll know how to evaluate companies</li>
                    <li>You''ll have the confidence to make informed decisions</li>
                    <li>You''ll be part of a community of young investors asking hard questions</li>
                </ul>
            </div>

            <h3 class="text-xl font-bold mt-6">A Final Challenge</h3>

            <p>As you move forward with Fund 6 and into your year-long competition:</p>

            <ol class="list-decimal list-inside space-y-3 ml-2">
                <li><strong>Stay curious.</strong> The world changes. Your thesis should evolve with it.</li>
                <li><strong>Stay disciplined.</strong> Don''t chase short-term noise. Remember why you bought each stock.</li>
                <li><strong>Stay humble.</strong> The market humbles everyone. Learn from your losses faster than from your wins.</li>
                <li><strong>Stay connected.</strong> Your classmates are your peers. Learn from them. Celebrate their wins and lessons from their losses.</li>
            </ol>

            <div class="alert alert-info my-6">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>In Robert Kiyosaki''s framework, you''ve taken your first real steps into the <strong>"I" quadrant—the Investor</strong>. You''re thinking like an owner, not an employee. That''s rare and valuable.</span>
            </div>

            <h3 class="text-xl font-bold">Important Disclosure</h3>
            <p class="text-sm text-base-content/70">This educational program is provided for learning purposes only. It is not financial, investment, legal, or tax advice. Investing in financial markets involves risk, including potential loss of principal. Before making any investment decisions, consult with a qualified financial advisor.</p>

            <div class="text-center mt-8 pt-6 border-t">
                <p class="text-lg font-bold">You''ve got this. Now go show the market what you can do.</p>
                <p class="text-base-content/60 mt-2">🚀 Let''s beat the S&P 500.</p>
            </div>
        </div>', 5, 12);
END $$;
