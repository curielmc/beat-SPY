export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://omrfqisqsqgidcqellzy.supabase.co'
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
  
  if (!SUPABASE_KEY) {
    return new Response('Server not configured', { status: 500 })
  }

  const payload = await req.json()
  
  // AgentMail payload structure: { event_type: 'message.received', message: { from_: [...], subject: '...', text: '...' } }
  if (payload.event_type !== 'message.received') {
    return new Response('Ignored event type', { status: 200 })
  }

  const msgData = payload.message
  const senderEmail = msgData.from_?.[0]
  const subject = msgData.subject || ''
  const content = msgData.text || ''

  if (!senderEmail) return new Response('No sender email', { status: 400 })

  const sbFetch = (path, options = {}) => fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: { 
      apikey: SUPABASE_KEY, 
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  }).then(r => r.ok ? r.json() : null)

  // 1. Find sender profile
  const profiles = await sbFetch(`/profiles?email=eq.${senderEmail}&select=id,role`)
  const sender = profiles?.[0]
  if (!sender) return new Response('Sender profile not found', { status: 200 })

  let classId = null
  let recipientId = null
  let recipientType = 'user'

  // 2. Try to find parent message ID from subject
  const msgIdMatch = subject.match(/\[Msg: ([\w-]+)\]/)
  const parentMsgId = msgIdMatch ? msgIdMatch[1] : null

  if (parentMsgId) {
    const parentMsgs = await sbFetch(`/messages?id=eq.${parentMsgId}&select=class_id,sender_id,recipient_id,recipient_type`)
    const parentMsg = parentMsgs?.[0]
    
    if (parentMsg) {
      classId = parentMsg.class_id
      // If sender is the original sender, recipient is original recipient
      // If sender is the original recipient, recipient is original sender
      recipientId = (sender.id === parentMsg.sender_id) ? parentMsg.recipient_id : parentMsg.sender_id
    }
  }

  // 3. Fallback: Find class and recipient based on sender role
  if (!classId || !recipientId) {
    const memberships = await sbFetch(`/class_memberships?user_id=eq.${sender.id}&select=class_id`)
    const membership = memberships?.[0]
    if (membership) {
      classId = membership.class_id
      
      if (sender.role === 'student') {
        // Message the teacher of this class
        const teachers = await sbFetch(`/profiles?role=eq.teacher&select=id`)
        recipientId = teachers?.[0]?.id
      }
    }
  }

  if (!classId || !recipientId) {
    return new Response('Could not determine message context', { status: 200 })
  }

  // 4. Clean up content (optional: remove email signature/quotes)
  // For now, just take the whole text. 
  // A common trick is splitting by "From:" or "On ... wrote:"
  const cleanContent = content.split(/\r?\nOn .* wrote:/i)[0].trim()

  // 5. Insert into Supabase
  const res = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
    method: 'POST',
    headers: { 
      apikey: SUPABASE_KEY, 
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      class_id: classId,
      sender_id: sender.id,
      recipient_type: recipientType,
      recipient_id: recipientId,
      content: cleanContent || content
    })
  })

  if (!res.ok) {
    const err = await res.text()
    return new Response(`Error inserting message: ${err}`, { status: 500 })
  }

  return new Response('OK', { status: 200 })
}
