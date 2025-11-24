import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { columns, Problem } from "./columns";
import { DataTable } from "@/components/ui/data-table";
import ChangeStatusModal from "@/components/ministry/ChangeStatusModal";

const MinistryProblemsPage = () => {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);

  const fetchProblems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("problems")
      .select("id, title, status, category, created_at");

    if (error) {
      console.error("Error fetching problems:", error);
    } else {
      setProblems(data as Problem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProblems();
  }, []);

  const handleOpenStatusModal = (problem: Problem) => {
    setSelectedProblem(problem);
  };

  const handleCloseModal = () => {
    setSelectedProblem(null);
  };

  const handleSuccess = () => {
    handleCloseModal();
    fetchProblems();
  };

  if (loading) {
    return <div>Loading problems...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Problem Management</h1>
      <DataTable
        columns={columns}
        data={problems}
        meta={{
          openStatusModal: handleOpenStatusModal,
        }}
      />
      {selectedProblem && (
        <ChangeStatusModal
          problem={selectedProblem}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
};

export default MinistryProblemsPage;
