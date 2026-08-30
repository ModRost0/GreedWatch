// src/components/CommentsSection.jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import styles from './CommentsSection.module.css';

export default function CommentsSection({ mediaId, mediaType, title }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [userReactions, setUserReactions] = useState({});
  const [userProfiles, setUserProfiles] = useState({});
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  
  const getUsername = useCallback((userId) => {
    if (userProfiles[userId]?.username) return userProfiles[userId].username;
    if (user && userId === user.id) return user.email?.split('@')[0] || 'You';
    return 'User';
  }, [userProfiles, user]);
  
  const loadComments = useCallback(async () => {
    try {
      const { data: allComments, error } = await supabase
        .from('comments')
        .select('*')
        .eq('media_id', String(mediaId))
        .order('created_at', { ascending: true });
      
      if (error) {
        setComments([]);
        setLoading(false);
        return;
      }
      
      const userIds = [...new Set((allComments || []).map(c => c.user_id))];
      
      let profileMap = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username, full_name')
          .in('id', userIds);
        
        (profilesData || []).forEach(p => {
          profileMap[p.id] = { username: p.username || p.full_name || 'User' };
        });
      }
      
      if (user) {
        profileMap[user.id] = { username: user.email?.split('@')[0] || 'You' };
      }
      
      setUserProfiles(profileMap);
      
      const commentMap = {};
      const rootComments = [];
      
      (allComments || []).forEach(comment => {
        commentMap[comment.id] = { ...comment, replies: [] };
      });
      
      (allComments || []).forEach(comment => {
        if (comment.parent_id && commentMap[comment.parent_id]) {
          commentMap[comment.parent_id].replies.push(commentMap[comment.id]);
        } else if (!comment.parent_id) {
          rootComments.push(commentMap[comment.id]);
        }
      });
      
      rootComments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setComments(rootComments);
      
      if (user) {
        const { data: reactions } = await supabase
          .from('comment_reactions')
          .select('comment_id, reaction')
          .eq('user_id', user.id);
        
        if (reactions) {
          const reactionMap = {};
          reactions.forEach(r => {
            reactionMap[r.comment_id] = r.reaction;
          });
          setUserReactions(reactionMap);
        }
      }
    } catch (error) {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [mediaId, user]);
  
  useEffect(() => {
    loadComments();
  }, [loadComments]);
  
  async function ensureUserProfile() {
    if (!user) return false;
    
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();
      
      if (!existingProfile) {
        await supabase.from('profiles').insert({
          id: user.id,
          username: user.email?.split('@')[0] || 'User',
        });
      }
      
      setUserProfiles(prev => ({
        ...prev,
        [user.id]: { username: user.email?.split('@')[0] || 'You' },
      }));
      
      return true;
    } catch (error) {
      return true;
    }
  }
  
  async function handleSubmit(e) {
    e.preventDefault();
    if (!user || !newComment.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      await ensureUserProfile();
      
      const { data, error } = await supabase.from('comments').insert({
        user_id: user.id,
        media_id: String(mediaId),
        media_type: mediaType,
        content: newComment.trim(),
      }).select().single();
      
      if (!error && data) {
        setComments(prev => [{ ...data, replies: [] }, ...prev]);
        setNewComment('');
      }
    } catch (error) {
      console.error('Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  }
  
  async function handleReply(parentComment) {
    if (!user || !replyContent.trim()) return;
    
    try {
      await ensureUserProfile();
      
      const { data, error } = await supabase.from('comments').insert({
        user_id: user.id,
        media_id: String(mediaId),
        media_type: mediaType,
        content: replyContent.trim(),
        parent_id: parentComment.id,
      }).select().single();
      
      if (!error && data) {
        setComments(prev => {
          const updateReplies = (commentList) => {
            return commentList.map(c => {
              if (c.id === parentComment.id) {
                return { ...c, replies: [...(c.replies || []), { ...data, replies: [] }] };
              }
              if (c.replies && c.replies.length > 0) {
                return { ...c, replies: updateReplies(c.replies) };
              }
              return c;
            });
          };
          return updateReplies(prev);
        });
        
        setReplyContent('');
        setReplyingTo(null);
        
        if (parentComment.user_id !== user.id) {
          try {
            await supabase.from('notifications').insert({
              user_id: parentComment.user_id,
              type: 'reply',
              content: `${user.email?.split('@')[0]} replied to your comment`,
              link: `/embed/${mediaType}/${mediaId}`,
            });
          } catch (notifError) {}
        }
      }
    } catch (error) {
      console.error('Failed to reply');
    }
  }
  
  async function handleDelete(commentId) {
    try {
      await supabase.from('comments').delete().eq('id', commentId);
      
      setComments(prev => {
        const removeComment = (commentList) => {
          return commentList
            .filter(c => c.id !== commentId)
            .map(c => ({
              ...c,
              replies: c.replies ? removeComment(c.replies) : [],
            }));
        };
        return removeComment(prev);
      });
      
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Failed to delete comment');
    }
  }
  
  async function handleReaction(commentId, reaction) {
    if (!user) {
      alert('Please sign in to react');
      return;
    }
    
    const existingReaction = userReactions[commentId];
    
    const updateCommentReaction = (commentList, id, reactionType, delta) => {
      return commentList.map(c => {
        if (c.id === id) {
          return { ...c, [reactionType + 's']: Math.max(0, (c[reactionType + 's'] || 0) + delta) };
        }
        if (c.replies && c.replies.length > 0) {
          return { ...c, replies: updateCommentReaction(c.replies, id, reactionType, delta) };
        }
        return c;
      });
    };
    
    try {
      if (existingReaction === reaction) {
        await supabase.from('comment_reactions').delete()
          .eq('user_id', user.id)
          .eq('comment_id', commentId);
        
        setUserReactions(prev => ({ ...prev, [commentId]: null }));
        setComments(prev => updateCommentReaction(prev, commentId, reaction, -1));
      } else {
        if (existingReaction) {
          await supabase.from('comment_reactions').delete()
            .eq('user_id', user.id)
            .eq('comment_id', commentId);
          setComments(prev => updateCommentReaction(prev, commentId, existingReaction, -1));
        }
        
        await supabase.from('comment_reactions').upsert({
          user_id: user.id,
          comment_id: commentId,
          reaction: reaction,
        }, { onConflict: 'user_id,comment_id' });
        
        setUserReactions(prev => ({ ...prev, [commentId]: reaction }));
        setComments(prev => updateCommentReaction(prev, commentId, reaction, 1));
      }
    } catch (error) {
      loadComments();
    }
  }
  
  function renderComment(comment, depth = 0) {
    return (
      <div key={comment.id} className={styles.commentItem} style={{ marginLeft: depth > 0 ? '20px' : '0' }}>
        <div className={styles.commentHeader}>
          <span className={styles.commentUser}>{getUsername(comment.user_id)}</span>
          <span className={styles.commentDate}>
            {new Date(comment.created_at).toLocaleDateString()}
          </span>
        </div>
        <p className={styles.commentContent}>{comment.content}</p>
        
        <div className={styles.commentActions}>
          <button 
            className={`${styles.reactionButton} ${userReactions[comment.id] === 'like' ? styles.activeReaction : ''}`}
            onClick={() => handleReaction(comment.id, 'like')}
          >
            👍 {comment.likes || 0}
          </button>
          <button 
            className={`${styles.reactionButton} ${userReactions[comment.id] === 'dislike' ? styles.activeReaction : ''}`}
            onClick={() => handleReaction(comment.id, 'dislike')}
          >
            👎 {comment.dislikes || 0}
          </button>
          <button 
            className={styles.replyButton}
            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
          >
            Reply
          </button>
          
          {user?.id === comment.user_id && (
            deleteConfirmId === comment.id ? (
              <div className={styles.deleteConfirm}>
                <span>Delete?</span>
                <button className={styles.confirmDeleteButton} onClick={() => handleDelete(comment.id)}>Yes</button>
                <button className={styles.cancelDeleteButton} onClick={() => setDeleteConfirmId(null)}>No</button>
              </div>
            ) : (
              <button className={styles.deleteButton} onClick={() => setDeleteConfirmId(comment.id)}>Delete</button>
            )
          )}
        </div>
        
        {replyingTo === comment.id && (
          <div className={styles.replyForm}>
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder={`Reply to ${getUsername(comment.user_id)}...`}
              rows={2}
            />
            <div className={styles.replyActions}>
              <button onClick={() => handleReply(comment)}>Reply</button>
              <button onClick={() => setReplyingTo(null)}>Cancel</button>
            </div>
          </div>
        )}
        
        {comment.replies && comment.replies.length > 0 && (
          <div className={styles.repliesList}>
            {comment.replies.map(reply => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className={styles.commentsContainer}>
      <h3 className={styles.commentsTitle}>Comments ({comments.length})</h3>
      
      <form onSubmit={handleSubmit} className={styles.commentForm}>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={user ? 'Share your thoughts...' : 'Sign in to comment'}
          disabled={!user || isSubmitting}
          rows={3}
        />
        <button type="submit" disabled={!user || !newComment.trim() || isSubmitting}>
          {isSubmitting ? 'Posting...' : 'Post Comment'}
        </button>
      </form>
      
      <div className={styles.commentsList}>
        {loading ? (
          <p>Loading...</p>
        ) : comments.length > 0 ? (
          comments.map(comment => renderComment(comment))
        ) : (
          <p className={styles.noComments}>No comments yet. Be the first!</p>
        )}
      </div>
    </div>
  );
}