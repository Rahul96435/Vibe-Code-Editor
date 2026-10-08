// when we need current for client component we can use this hook to get the current user
import { useSession } from "next-auth/react";


export const useCurrentUser = ()=>{
    const session = useSession();

    return session?.data?.user
}