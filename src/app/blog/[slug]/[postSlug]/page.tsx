import 'server-only'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  // Legacy route no longer supported
  return {
    title: 'Post Not Found',
    description: 'This post route is no longer supported. Please use tenant-based URLs.'
  }
}

export default async function PostPage() {
  // Legacy route - redirect to tenant-based routing
  // Since blog slug is no longer globally unique, we can't resolve posts this way
  notFound()
}