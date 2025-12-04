/*
  # Enable Real-time for Chat Tables

  1. Changes
    - Enable real-time for `conversations` table
    - Enable real-time for `messages` table
  
  2. Purpose
    - Allow real-time subscriptions to receive instant updates when new messages arrive
    - Enable live chat functionality with automatic UI updates
    - Support web notifications for incoming messages
*/

-- Enable realtime for conversations table
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
