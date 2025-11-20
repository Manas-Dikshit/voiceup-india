-- Create enum types
CREATE TYPE problem_status AS ENUM ('reported', 'under_review', 'approved', 'in_progress', 'completed', 'rejected');
CREATE TYPE problem_category AS ENUM ('roads', 'water', 'electricity', 'sanitation', 'education', 'healthcare', 'pollution', 'safety', 'other');
CREATE TYPE user_role AS ENUM ('citizen', 'ministry', 'admin');
CREATE TYPE vote_type AS ENUM ('upvote', 'downvote');
CREATE TYPE votable_type AS ENUM ('problem', 'solution');
CREATE TYPE commentable_type AS ENUM ('problem', 'solution');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  badges TEXT[] DEFAULT '{}',
  role user_role DEFAULT 'citizen',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create problems table
CREATE TABLE public.problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category problem_category NOT NULL,
  media_url TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  status problem_status DEFAULT 'reported',
  votes_count INTEGER DEFAULT 0,
  ai_tags TEXT[] DEFAULT '{}',
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create solutions table
CREATE TABLE public.solutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID REFERENCES public.problems(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  media_url TEXT,
  votes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create votes table
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  votable_type votable_type NOT NULL,
  votable_id UUID NOT NULL,
  vote_type vote_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, votable_type, votable_id)
);

-- Create comments table
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  commentable_type commentable_type NOT NULL,
  commentable_id UUID NOT NULL,
  content TEXT NOT NULL,
  sentiment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- RLS Policies for problems
CREATE POLICY "Anyone can view problems"
  ON public.problems FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create problems"
  ON public.problems FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own problems"
  ON public.problems FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for solutions
CREATE POLICY "Anyone can view solutions"
  ON public.solutions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create solutions"
  ON public.solutions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own solutions"
  ON public.solutions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for votes
CREATE POLICY "Anyone can view votes"
  ON public.votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create votes"
  ON public.votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes"
  ON public.votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for comments
CREATE POLICY "Anyone can view comments"
  ON public.comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', 'Anonymous User'));
  RETURN new;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for updating timestamps
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_problems_updated_at
  BEFORE UPDATE ON public.problems
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_solutions_updated_at
  BEFORE UPDATE ON public.solutions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_problems_user_id ON public.problems(user_id);
CREATE INDEX idx_problems_status ON public.problems(status);
CREATE INDEX idx_problems_category ON public.problems(category);
CREATE INDEX idx_problems_location ON public.problems(latitude, longitude);
CREATE INDEX idx_solutions_problem_id ON public.solutions(problem_id);
CREATE INDEX idx_votes_votable ON public.votes(votable_type, votable_id);
CREATE INDEX idx_comments_commentable ON public.comments(commentable_type, commentable_id);