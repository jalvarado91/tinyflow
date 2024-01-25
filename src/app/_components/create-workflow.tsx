"use client";

import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";

import { api } from "~/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";

const formSchema = z.object({
  name: z.string().min(2),
  projectId: z.string().min(1),
  apiKey: z.string().min(1),
});

export function CreateWorkflow() {
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      projectId: "",
      apiKey: "",
    },
  });

  const createWorkflow = api.workflow.create.useMutation({
    onSuccess: () => {
      router.refresh();
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createWorkflow.mutate({
      name: values.name,
      projectId: values.projectId,
      apiKey: values.apiKey,
    });
  }

  return (
    <>
      <Card className="w-full max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle>Create a workflow</CardTitle>
              <CardDescription>
                {
                  "To create a workflow we'll need to setup a couple things first"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="LLM Question Answering"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        A friendly name for your workflow
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Id</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormDescription>
                        The railway project id where resources will be created
                        in
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Api Key</FormLabel>
                      <FormControl>
                        <Input autoComplete="off" {...field} />
                      </FormControl>
                      <FormDescription>Your railway API Key</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                type="submit"
                disabled={createWorkflow.isLoading}
                className="w-full"
              >
                {createWorkflow.isLoading ? "Creating workflow" : "Create"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </>
  );
}
