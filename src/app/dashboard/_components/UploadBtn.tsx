"use client"
import { Button } from "@/components/ui/button";
import { useOrganization, useUser } from "@clerk/clerk-react";
import { useMutation } from "convex/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { api } from "../../../../convex/_generated/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Doc } from "../../../../convex/_generated/dataModel";

const formSchema = z.object({
    title: z.string().min(1).max(200),
    file: z.custom<FileList>((val) => val instanceof FileList, "Required")
        .refine((files) => files.length > 0, `Required`),
})



export function UploadBtn() {

    const { toast } = useToast();
    const organization = useOrganization();
    const user = useUser();
    const generateUploadUrl = useMutation(api.files.generateUploadUrl);
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            file: undefined
        },
    })
    const fileRef = form.register("file");

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!orgId) return;
        const postUrl = await generateUploadUrl();
        const typeOfFile = values.file[0].type ;
        const result = await fetch(postUrl, {
            method: "POST",
            headers: { "Content-Type": typeOfFile },
            body: values.file[0],
        });
        const { storageId } = await result.json();
      

        const types = {
            "image/png" : "image",
            "application/pdf" : "pdf",
            "text/csv": "csv"
        } as Record<string ,Doc<"files">["type"]>;
        try {
            await createFile({ 
                name: values.title,
                fileId: storageId,
                orgId,
                type : types[typeOfFile]
            });
            form.reset();
            setisFileDialogOpen(false);
            toast({
                variant: "success",
                title: "File Uploaded",
                description: "Now everyone can view your file"
            })
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Something went wrong",
                description: "Your File could not be Uploaded , try again later"
            })
        }


    }

    let orgId: string | undefined = undefined;
    if (organization.isLoaded && user.isLoaded) {
        orgId = organization.organization?.id ?? user.user?.id;
    }

    const [isFileDialogOpen, setisFileDialogOpen] = useState(false)


    const createFile = useMutation(api.files.createFile);
    return (

        <Dialog open={isFileDialogOpen} onOpenChange={(isOpen) => {
            setisFileDialogOpen(isOpen);
            form.reset();
        }}
        >
            <DialogTrigger asChild >
                <Button>
                    Upload File
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="mb-8" >Upload your File Here</DialogTitle>
                    <DialogDescription>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                                <FormField
                                    control={form.control}
                                    name="title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Title</FormLabel>
                                            <FormControl>
                                                <Input placeholder="shadcn" {...field} />
                                            </FormControl>

                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="file"
                                    render={({ field: { onChange }, ...field }) => (
                                        <FormItem>
                                            <FormLabel>File</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="file" {...fileRef}
                                                    onChange={(event) => {
                                                        if (!event.target.files) return;
                                                        onChange(event.target.files[0])
                                                    }}
                                                />
                                            </FormControl>

                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Button type="submit" disabled={form.formState.isSubmitting} className="flex gap-1" >
                                    {form.formState.isSubmitting && (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    )}
                                    Submit
                                </Button>
                            </form>
                        </Form>
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>



    );
}