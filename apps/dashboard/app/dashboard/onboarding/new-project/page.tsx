import { CreateProjectForm } from '@/components/projects/CreateProjectForm';

export default function NewProjectPage() {
  return (
    <div className="container mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-xl font-semibold">Create a project</h1>
      <CreateProjectForm />
    </div>
  );
}
