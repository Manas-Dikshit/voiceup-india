-- =============================================
-- COMPREHENSIVE DATABASE MIGRATION
-- Adds: ratings, notifications, audit_logs, impact_tracker
-- Updates: profiles (language, city), problems (moderation fields)
-- =============================================

-- 1. Add language and city columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en',
ADD COLUMN IF NOT EXISTS city TEXT;

-- 2. Add moderation columns to problems table
ALTER TABLE public.problems 
ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS quality_score NUMERIC,
ADD COLUMN IF NOT EXISTS moderation_reason TEXT,
ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS pincode TEXT;

-- 3. Create ratings table
CREATE TABLE IF NOT EXISTS public.ratings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(problem_id, user_id)
);

-- Enable RLS on ratings
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- RLS policies for ratings
CREATE POLICY "Anyone can view ratings" ON public.ratings
FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create ratings" ON public.ratings
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings" ON public.ratings
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ratings" ON public.ratings
FOR DELETE USING (auth.uid() = user_id);

-- 4. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    problem_id UUID REFERENCES public.problems(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON public.notifications
FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" ON public.notifications
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications" ON public.notifications
FOR DELETE USING (auth.uid() = user_id);

-- 5. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for audit_logs (ministry/admin only for viewing)
CREATE POLICY "Anyone can insert audit logs" ON public.audit_logs
FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can view audit logs" ON public.audit_logs
FOR SELECT USING (auth.uid() IS NOT NULL);

-- 6. Create moderation_audit table
CREATE TABLE IF NOT EXISTS public.moderation_audit (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT,
    moderator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    moderated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on moderation_audit
ALTER TABLE public.moderation_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert moderation audit" ON public.moderation_audit
FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can view moderation audit" ON public.moderation_audit
FOR SELECT USING (auth.uid() IS NOT NULL);

-- 7. Create impact_tracker view for real-time civic impact metrics
CREATE OR REPLACE VIEW public.impact_tracker AS
SELECT 
    p.category,
    p.city as location,
    COUNT(*) FILTER (WHERE p.status = 'completed') as resolved_count,
    COUNT(*) FILTER (WHERE p.status IN ('reported', 'under_review', 'approved', 'in_progress')) as pending_count,
    COALESCE(
        EXTRACT(EPOCH FROM AVG(
            CASE WHEN p.status = 'completed' 
            THEN p.updated_at - p.created_at 
            END
        )) / 3600,
        0
    )::INTEGER as avg_response_time,
    COALESCE(SUM(p.votes_count), 0)::INTEGER as engagement_score
FROM public.problems p
WHERE p.is_deleted IS NOT TRUE
GROUP BY p.category, p.city;

-- 8. Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.problems;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ratings;

-- 9. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_problems_is_flagged ON public.problems(is_flagged) WHERE is_flagged = true;
CREATE INDEX IF NOT EXISTS idx_problems_status ON public.problems(status);
CREATE INDEX IF NOT EXISTS idx_problems_category ON public.problems(category);
CREATE INDEX IF NOT EXISTS idx_problems_city ON public.problems(city);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_problem_id ON public.ratings(problem_id);
CREATE INDEX IF NOT EXISTS idx_ratings_user_id ON public.ratings(user_id);